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
  cancelled: boolean;
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

const queue: QueueJob<unknown>[] = [];
let runningJobs = 0;
let draining = false;

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

async function executeJob(nextJob: QueueJob<unknown>): Promise<void> {
  if (nextJob.cancelled) {
    return;
  }

  clearQueueTimeout(nextJob);

  try {
    const result = await nextJob.task();
    nextJob.resolve(result);
  } catch (error) {
    nextJob.reject(error);
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
      cancelled: false,
    };

    const timeoutId = setTimeout(() => {
      job.cancelled = true;
      removeJob(job as QueueJob<unknown>);
      clearQueueTimeout(job as QueueJob<unknown>);
      reject(new SummarizeQueueTimeoutError());
    }, maxWaitMs);
    job.timeoutId = timeoutId;

    queue.push(job as QueueJob<unknown>);
    drainQueue();
  });
}
