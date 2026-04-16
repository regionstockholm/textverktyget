import { createClient } from "redis";
import { config as appConfig } from "../config/app-config.js";
import { safetyConfig } from "../config/shared-config.js";
import { logger } from "./logger.js";
import { assert } from "./safety-utils.js";

const DEFAULT_TIME_WINDOW_MS = 60 * 1000;
const MAX_WAIT_TIME_MS = safetyConfig.MAX_TIMEOUT_DURATION || 5 * 60 * 1000;
const MIN_REQUESTS_PER_MINUTE = 1;
const MAX_REQUESTS_PER_MINUTE = 1000;
const MIN_RETRY_WAIT_MS = 25;

const REDIS_URL =
  process.env.RATE_LIMIT_REDIS_URL?.trim() || process.env.REDIS_URL?.trim() || "";
const REDIS_KEY_PREFIX =
  process.env.RATE_LIMIT_KEY_PREFIX?.trim() || "textverktyg:rate_limit";
const DEFAULT_GROUP_ID = process.env.GROUP_ID?.trim() || "default";

const REDIS_LIMITER_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local current = redis.call('ZCARD', key)

if current >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if oldest[2] then
    retryAfter = window - (now - tonumber(oldest[2]))
  end
  if retryAfter < 0 then
    retryAfter = 0
  end
  return {0, retryAfter}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, 0}
`;

export interface RateLimiter {
  getRequestCount(): number;
  getLastRequestTime(): number;
  reset(): void;
  checkLimit(): Promise<void>;
}

export interface RateLimiterOptions {
  scope?: string;
  groupId?: string;
}

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<RedisClient | null> | null = null;
let redisUnavailableLogged = false;

function validateRateLimiterParams(requestsPerMinute: number): void {
  assert(
    typeof requestsPerMinute === "number",
    "Requests per minute must be a number",
  );
  assert(
    requestsPerMinute >= MIN_REQUESTS_PER_MINUTE,
    `Requests per minute must be at least ${MIN_REQUESTS_PER_MINUTE}`,
  );
  assert(
    requestsPerMinute <= MAX_REQUESTS_PER_MINUTE,
    `Requests per minute must not exceed ${MAX_REQUESTS_PER_MINUTE}`,
  );
}

function calculateWaitTime(
  currentTime: number,
  lastRequestTime: number,
  timeWindow: number,
): number {
  assert(typeof currentTime === "number", "Current time must be a number");
  assert(
    typeof lastRequestTime === "number",
    "Last request time must be a number",
  );
  assert(typeof timeWindow === "number", "Time window must be a number");
  assert(timeWindow > 0, "Time window must be positive");

  const waitTime = timeWindow - (currentTime - lastRequestTime);
  return Math.min(Math.max(0, waitTime), MAX_WAIT_TIME_MS);
}

async function wait(waitTime: number): Promise<void> {
  assert(typeof waitTime === "number", "Wait time must be a number");
  assert(waitTime >= 0, "Wait time must be non-negative");
  assert(
    waitTime <= MAX_WAIT_TIME_MS,
    `Wait time must not exceed ${MAX_WAIT_TIME_MS}ms`,
  );

  if (waitTime <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, waitTime));
}

function resolveScope(options?: RateLimiterOptions): string {
  const scope = options?.scope?.trim();
  if (!scope) {
    return "default";
  }
  return scope;
}

function resolveGroupId(options?: RateLimiterOptions): string {
  const groupId = options?.groupId?.trim();
  if (!groupId) {
    return DEFAULT_GROUP_ID;
  }
  return groupId;
}

function buildRedisLimiterKey(options?: RateLimiterOptions): string {
  const groupId = resolveGroupId(options);
  const scope = resolveScope(options);
  return `${REDIS_KEY_PREFIX}:${groupId}:${scope}`;
}

function createRedisRequestMember(): string {
  return `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

async function getRedisClient(): Promise<RedisClient | null> {
  if (!appConfig.features.sharedLimiter || !REDIS_URL) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  redisConnectPromise = (async () => {
    try {
      const client = createClient({ url: REDIS_URL });
      client.on("error", (error) => {
        logger.warn("rate_limiter.redis.error", {
          processStatus: "running",
          meta: { reason: error.message },
        });
      });
      await client.connect();
      redisClient = client;
      redisUnavailableLogged = false;
      logger.info("rate_limiter.redis.connected", {
        processStatus: "running",
      });
      return redisClient;
    } catch (error) {
      if (!redisUnavailableLogged) {
        logger.warn("rate_limiter.redis.unavailable", {
          processStatus: "running",
          meta: {
            reason: error instanceof Error ? error.message : "unknown",
          },
        });
        redisUnavailableLogged = true;
      }
      redisClient = null;
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

async function acquireRedisSlot(
  client: RedisClient,
  key: string,
  requestsPerMinute: number,
  timeWindow: number,
): Promise<{ allowed: boolean; waitMs: number }> {
  const result = await client.eval(REDIS_LIMITER_SCRIPT, {
    keys: [key],
    arguments: [
      Date.now().toString(),
      timeWindow.toString(),
      requestsPerMinute.toString(),
      createRedisRequestMember(),
    ],
  });

  if (!Array.isArray(result) || result.length < 2) {
    return { allowed: true, waitMs: 0 };
  }

  const allowed = Number(result[0]) === 1;
  const waitMsRaw = Number(result[1]);
  const waitMs = Number.isFinite(waitMsRaw)
    ? Math.min(Math.max(waitMsRaw, 0), MAX_WAIT_TIME_MS)
    : 0;

  return {
    allowed,
    waitMs,
  };
}

export function createRateLimiter(
  requestsPerMinute: number,
  options?: RateLimiterOptions,
): RateLimiter {
  validateRateLimiterParams(requestsPerMinute);

  let requestCount = 0;
  let lastRequestTime = Date.now();
  const timeWindow = DEFAULT_TIME_WINDOW_MS;
  const redisKey = buildRedisLimiterKey(options);

  return {
    getRequestCount(): number {
      return requestCount;
    },

    getLastRequestTime(): number {
      return lastRequestTime;
    },

    reset(): void {
      requestCount = 0;
      lastRequestTime = Date.now();
    },

    async checkLimit(): Promise<void> {
      const client = await getRedisClient();
      if (client) {
        while (true) {
          try {
            const { allowed, waitMs } = await acquireRedisSlot(
              client,
              redisKey,
              requestsPerMinute,
              timeWindow,
            );

            if (allowed) {
              requestCount = Math.max(0, requestCount + 1);
              lastRequestTime = Date.now();
              return;
            }

            const safeWait =
              waitMs > 0 ? waitMs : Math.min(MIN_RETRY_WAIT_MS, MAX_WAIT_TIME_MS);
            await wait(safeWait);
          } catch (error) {
            logger.warn("rate_limiter.redis.fallback", {
              processStatus: "running",
              meta: {
                reason: error instanceof Error ? error.message : "unknown",
                key: redisKey,
              },
            });
            break;
          }
        }
      }

      const currentTime = Date.now();

      if (currentTime - lastRequestTime > timeWindow) {
        requestCount = 0;
        lastRequestTime = currentTime;
        return;
      }

      if (requestCount >= requestsPerMinute) {
        const waitTime = calculateWaitTime(currentTime, lastRequestTime, timeWindow);

        if (waitTime > 0) {
          await wait(waitTime);
          requestCount = 0;
          lastRequestTime = Date.now();
        }
      }

      requestCount++;
    },
  };
}
