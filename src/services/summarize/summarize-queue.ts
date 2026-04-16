import { createClient } from "redis";
import { config } from "../../config/app-config.js";
import { logger } from "../../utils/logger.js";
import { readRuntimeInteger } from "../../utils/runtime-number.js";
import configService from "../config/config-service.js";

type QueueJob<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  enqueuedAt: number;
  timeoutId: NodeJS.Timeout | null;
  token: string;
  cancelled: boolean;
  sharedCapacityReserved: boolean;
  sharedExecutionReserved: boolean;
};

export class SummarizeQueueOverloadedError extends Error {
  constructor() {
    super("Summarize queue is full");
    this.name = "SummarizeQueueOverloadedError";
  }
}

export class SummarizeQueueTimeoutError extends Error {
  constructor() {
    super("Summarize request waited too long in queue");
    this.name = "SummarizeQueueTimeoutError";
  }
}

const SHARED_QUEUE_REDIS_URL =
  process.env.SUMMARIZE_QUEUE_REDIS_URL?.trim() ||
  process.env.RATE_LIMIT_REDIS_URL?.trim() ||
  process.env.REDIS_URL?.trim() ||
  "";
const SHARED_QUEUE_KEY_PREFIX =
  process.env.SUMMARIZE_QUEUE_KEY_PREFIX?.trim() ||
  "textverktyg:summarize_queue";
const GROUP_ID = process.env.GROUP_ID?.trim() || "default";
const SHARED_QUEUE_POLL_MS = 75;

const RESERVE_SHARED_SLOT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local token = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now)
local current = redis.call('ZCARD', key)
if current >= limit then
  return 0
end

redis.call('ZADD', key, now + ttl, token)
redis.call('PEXPIRE', key, ttl)
return 1
`;

const RELEASE_SHARED_SLOT_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]
return redis.call('ZREM', key, token)
`;

const queue: QueueJob<unknown>[] = [];
let runningJobs = 0;
let draining = false;

type RedisClient = ReturnType<typeof createClient>;

let sharedRedisClient: RedisClient | null = null;
let sharedRedisConnectPromise: Promise<RedisClient | null> | null = null;
let sharedRedisUnavailableLogged = false;

type QueueConfig = typeof config.performance.summarizeQueue;

const RUNTIME_REFRESH_MS = 15000;
let runtimeQueueSettings: Record<string, unknown> | null = null;
let queueConfigFetchedAt = 0;
let queueConfigRefreshPromise: Promise<void> | null = null;

function getQueueConfig() {
  const defaults = config.performance.summarizeQueue;
  const raw = runtimeQueueSettings;

  return {
    maxConcurrentJobs: readRuntimeInteger(
      raw?.maxConcurrentJobs,
      defaults.maxConcurrentJobs,
      1,
      200,
    ),
    maxQueueSize: readRuntimeInteger(raw?.maxQueueSize, defaults.maxQueueSize, 1, 5000),
    maxWaitMs: readRuntimeInteger(raw?.maxWaitMs, defaults.maxWaitMs, 1000, 300000),
    sharedTokenTtlMs: readRuntimeInteger(
      raw?.sharedTokenTtlMs,
      defaults.sharedTokenTtlMs,
      60 * 1000,
      60 * 60 * 1000,
    ),
    retryAfterSeconds: readRuntimeInteger(
      raw?.retryAfterSeconds,
      defaults.retryAfterSeconds,
      1,
      300,
    ),
  };
}

export function resolveRuntimeSummarizeQueueConfig(
  runtimeSettings: unknown,
): QueueConfig {
  const defaults: QueueConfig = config.performance.summarizeQueue;
  const raw =
    runtimeSettings && typeof runtimeSettings === "object"
      ? (runtimeSettings as Record<string, unknown>).summarizeQueue
      : undefined;

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const summarizeQueue = raw as Record<string, unknown>;
  return {
    maxConcurrentJobs: readRuntimeInteger(
      summarizeQueue.maxConcurrentJobs,
      defaults.maxConcurrentJobs,
      1,
      200,
    ),
    maxQueueSize: readRuntimeInteger(
      summarizeQueue.maxQueueSize,
      defaults.maxQueueSize,
      1,
      5000,
    ),
    maxWaitMs: readRuntimeInteger(
      summarizeQueue.maxWaitMs,
      defaults.maxWaitMs,
      1000,
      300000,
    ),
    sharedTokenTtlMs: readRuntimeInteger(
      summarizeQueue.sharedTokenTtlMs,
      defaults.sharedTokenTtlMs,
      60 * 1000,
      60 * 60 * 1000,
    ),
    retryAfterSeconds: readRuntimeInteger(
      summarizeQueue.retryAfterSeconds,
      defaults.retryAfterSeconds,
      1,
      300,
    ),
  };
}

async function refreshQueueConfig(): Promise<void> {
  const now = Date.now();
  if (now - queueConfigFetchedAt < RUNTIME_REFRESH_MS) {
    return;
  }

  if (queueConfigRefreshPromise) {
    return queueConfigRefreshPromise;
  }

  queueConfigRefreshPromise = (async () => {
    try {
      const runtimeSettings = await configService.getRuntimeSettings();
      const summarizeQueue =
        runtimeSettings && typeof runtimeSettings === "object"
          ? (runtimeSettings as Record<string, unknown>).summarizeQueue
          : undefined;

      runtimeQueueSettings =
        summarizeQueue && typeof summarizeQueue === "object"
          ? (summarizeQueue as Record<string, unknown>)
          : null;
      queueConfigFetchedAt = Date.now();
    } catch {
      queueConfigFetchedAt = Date.now();
    } finally {
      queueConfigRefreshPromise = null;
    }
  })();

  return queueConfigRefreshPromise;
}

function getSharedQueueKeys(): { capacity: string; execution: string } {
  return {
    capacity: `${SHARED_QUEUE_KEY_PREFIX}:${GROUP_ID}:capacity`,
    execution: `${SHARED_QUEUE_KEY_PREFIX}:${GROUP_ID}:execution`,
  };
}

function sharedQueueEnabled(): boolean {
  return config.features.sharedLimiter && SHARED_QUEUE_REDIS_URL.length > 0;
}

async function wait(waitMs: number): Promise<void> {
  if (waitMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

function createJobToken(): string {
  return `${GROUP_ID}:${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function removeJob(job: QueueJob<unknown>): void {
  const index = queue.indexOf(job);
  if (index >= 0) {
    queue.splice(index, 1);
  }
}

function clearQueueTimeout(job: QueueJob<unknown>): void {
  if (job.timeoutId) {
    clearTimeout(job.timeoutId);
    job.timeoutId = null;
  }
}

async function getSharedRedisClient(): Promise<RedisClient | null> {
  if (!sharedQueueEnabled()) {
    return null;
  }

  if (sharedRedisClient?.isOpen) {
    return sharedRedisClient;
  }

  if (sharedRedisConnectPromise) {
    return sharedRedisConnectPromise;
  }

  sharedRedisConnectPromise = (async () => {
    try {
      const client = createClient({ url: SHARED_QUEUE_REDIS_URL });
      client.on("error", (error) => {
        logger.warn("summarize_queue.redis.error", {
          processStatus: "running",
          meta: { reason: error.message },
        });
      });
      await client.connect();
      sharedRedisClient = client;
      sharedRedisUnavailableLogged = false;
      logger.info("summarize_queue.redis.connected", {
        processStatus: "running",
        meta: { groupId: GROUP_ID },
      });
      return sharedRedisClient;
    } catch (error) {
      if (!sharedRedisUnavailableLogged) {
        logger.warn("summarize_queue.redis.unavailable", {
          processStatus: "running",
          meta: {
            groupId: GROUP_ID,
            reason: error instanceof Error ? error.message : "unknown",
          },
        });
        sharedRedisUnavailableLogged = true;
      }
      sharedRedisClient = null;
      return null;
    } finally {
      sharedRedisConnectPromise = null;
    }
  })();

  return sharedRedisConnectPromise;
}

async function reserveSharedSlot(
  key: string,
  token: string,
  limit: number,
  ttlMs: number,
): Promise<boolean> {
  const client = await getSharedRedisClient();
  if (!client) {
    return true;
  }

  try {
    const result = await client.eval(RESERVE_SHARED_SLOT_SCRIPT, {
      keys: [key],
      arguments: [
        Date.now().toString(),
        ttlMs.toString(),
        limit.toString(),
        token,
      ],
    });
    return Number(result) === 1;
  } catch (error) {
    logger.warn("summarize_queue.redis.reserve_failed", {
      processStatus: "running",
      meta: {
        key,
        reason: error instanceof Error ? error.message : "unknown",
      },
    });
    return true;
  }
}

async function releaseSharedSlot(key: string, token: string): Promise<void> {
  const client = await getSharedRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.eval(RELEASE_SHARED_SLOT_SCRIPT, {
      keys: [key],
      arguments: [token],
    });
  } catch (error) {
    logger.warn("summarize_queue.redis.release_failed", {
      processStatus: "running",
      meta: {
        key,
        reason: error instanceof Error ? error.message : "unknown",
      },
    });
  }
}

async function reserveSharedCapacity(job: QueueJob<unknown>): Promise<boolean> {
  const { maxConcurrentJobs, maxQueueSize, sharedTokenTtlMs } = getQueueConfig();
  const totalCapacity = maxConcurrentJobs + maxQueueSize;
  const keys = getSharedQueueKeys();

  const reserved = await reserveSharedSlot(
    keys.capacity,
    job.token,
    totalCapacity,
    sharedTokenTtlMs,
  );

  job.sharedCapacityReserved = reserved;
  return reserved;
}

async function releaseSharedCapacity(job: QueueJob<unknown>): Promise<void> {
  if (!job.sharedCapacityReserved) {
    return;
  }

  const keys = getSharedQueueKeys();
  await releaseSharedSlot(keys.capacity, job.token);
  job.sharedCapacityReserved = false;
}

async function reserveSharedExecution(
  job: QueueJob<unknown>,
  waitBudgetMs: number,
): Promise<boolean> {
  const { maxConcurrentJobs, sharedTokenTtlMs } = getQueueConfig();
  const keys = getSharedQueueKeys();

  if (waitBudgetMs <= 0) {
    return false;
  }

  const deadline = Date.now() + waitBudgetMs;

  while (Date.now() <= deadline) {
    const acquired = await reserveSharedSlot(
      keys.execution,
      job.token,
      maxConcurrentJobs,
      sharedTokenTtlMs,
    );

    if (acquired) {
      job.sharedExecutionReserved = true;
      return true;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return false;
    }

    await wait(Math.min(SHARED_QUEUE_POLL_MS, remaining));
  }

  return false;
}

async function releaseSharedExecution(job: QueueJob<unknown>): Promise<void> {
  if (!job.sharedExecutionReserved) {
    return;
  }

  const keys = getSharedQueueKeys();
  await releaseSharedSlot(keys.execution, job.token);
  job.sharedExecutionReserved = false;
}

async function executeJob(nextJob: QueueJob<unknown>): Promise<void> {
  if (nextJob.cancelled) {
    await releaseSharedCapacity(nextJob);
    return;
  }

  const { maxWaitMs } = getQueueConfig();
  clearQueueTimeout(nextJob);

  const elapsedWaitMs = Date.now() - nextJob.enqueuedAt;
  const waitBudgetMs = Math.max(0, maxWaitMs - elapsedWaitMs);
  const executionReserved = await reserveSharedExecution(nextJob, waitBudgetMs);

  if (!executionReserved) {
    nextJob.cancelled = true;
    await releaseSharedCapacity(nextJob);
    nextJob.reject(new SummarizeQueueTimeoutError());
    return;
  }

  try {
    const result = await nextJob.task();
    nextJob.resolve(result);
  } catch (error) {
    nextJob.reject(error);
  } finally {
    await releaseSharedExecution(nextJob);
    await releaseSharedCapacity(nextJob);
  }
}

async function processQueue(): Promise<void> {
  void refreshQueueConfig();
  const { maxConcurrentJobs } = getQueueConfig();

  while (runningJobs < maxConcurrentJobs && queue.length > 0) {
    const nextJob = queue.shift();
    if (!nextJob) {
      return;
    }

    runningJobs += 1;
    void executeJob(nextJob)
      .catch((error) => {
        logger.error("summarize_queue.execute_failed", {
          processStatus: "failed",
          meta: { reason: error instanceof Error ? error.message : "unknown" },
        });
      })
      .finally(() => {
        runningJobs = Math.max(0, runningJobs - 1);
        drainQueue();
      });
  }
}

function drainQueue(): void {
  if (draining) {
    return;
  }

  draining = true;
  void processQueue()
    .catch((error) => {
      logger.error("summarize_queue.drain_failed", {
        processStatus: "failed",
        meta: { reason: error instanceof Error ? error.message : "unknown" },
      });
    })
    .finally(() => {
      draining = false;
      if (queue.length > 0 && runningJobs < getQueueConfig().maxConcurrentJobs) {
        drainQueue();
      }
    });
}

export function getSummarizeQueueState() {
  void refreshQueueConfig();
  const { maxConcurrentJobs, maxQueueSize } = getQueueConfig();
  return {
    runningJobs,
    queuedJobs: queue.length,
    maxConcurrentJobs,
    maxQueueSize,
    retryAfterSeconds: getQueueConfig().retryAfterSeconds,
    sharedEnabled: sharedQueueEnabled(),
    groupId: GROUP_ID,
  };
}

export function enqueueSummarize<T>(task: () => Promise<T>): Promise<T> {
  void refreshQueueConfig();
  const { maxQueueSize, maxWaitMs } = getQueueConfig();

  if (queue.length >= maxQueueSize) {
    throw new SummarizeQueueOverloadedError();
  }

  return new Promise<T>((resolve, reject) => {
    const job: QueueJob<T> = {
      task,
      resolve,
      reject,
      enqueuedAt: Date.now(),
      timeoutId: null,
      token: createJobToken(),
      cancelled: false,
      sharedCapacityReserved: false,
      sharedExecutionReserved: false,
    };

    const timeoutId = setTimeout(() => {
      job.cancelled = true;
      removeJob(job as QueueJob<unknown>);
      clearQueueTimeout(job as QueueJob<unknown>);
      void releaseSharedCapacity(job as QueueJob<unknown>).finally(() => {
        reject(new SummarizeQueueTimeoutError());
      });
    }, maxWaitMs);
    job.timeoutId = timeoutId;

    if (!sharedQueueEnabled()) {
      queue.push(job as QueueJob<unknown>);
      drainQueue();
      return;
    }

    void reserveSharedCapacity(job as QueueJob<unknown>)
      .then((reserved) => {
        if (!reserved) {
          clearQueueTimeout(job as QueueJob<unknown>);
          reject(new SummarizeQueueOverloadedError());
          return;
        }

        if (job.cancelled) {
          clearQueueTimeout(job as QueueJob<unknown>);
          void releaseSharedCapacity(job as QueueJob<unknown>);
          return;
        }

        queue.push(job as QueueJob<unknown>);
        drainQueue();
      })
      .catch((error) => {
        clearQueueTimeout(job as QueueJob<unknown>);
        reject(error);
      });
  });
}
