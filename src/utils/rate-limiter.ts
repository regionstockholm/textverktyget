import { timeLimits } from "../config/shared-config.js";
import { assert } from "./safety-utils.js";

const DEFAULT_TIME_WINDOW_MS = 60 * 1000;
const MIN_REQUESTS_PER_MINUTE = 1;
const MAX_REQUESTS_PER_MINUTE = 1000;

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
  return Math.min(Math.max(0, waitTime), timeLimits.maxTimeoutDuration);
}

async function wait(waitTime: number): Promise<void> {
  assert(typeof waitTime === "number", "Wait time must be a number");
  assert(waitTime >= 0, "Wait time must be non-negative");
  assert(
    waitTime <= timeLimits.maxTimeoutDuration,
    `Wait time must not exceed ${timeLimits.maxTimeoutDuration}ms`,
  );

  if (waitTime <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, waitTime));
}

export function createRateLimiter(
  requestsPerMinute: number,
  _options?: RateLimiterOptions,
): RateLimiter {
  validateRateLimiterParams(requestsPerMinute);

  let requestCount = 0;
  let lastRequestTime = Date.now();
  const timeWindow = DEFAULT_TIME_WINDOW_MS;

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
      const currentTime = Date.now();

      if (currentTime - lastRequestTime > timeWindow) {
        requestCount = 0;
        lastRequestTime = currentTime;
        return;
      }

      if (requestCount >= requestsPerMinute) {
        const waitTime = calculateWaitTime(
          currentTime,
          lastRequestTime,
          timeWindow,
        );

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
