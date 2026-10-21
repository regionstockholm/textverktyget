import { assert } from "./safety-utils.js";

const DEFAULT_TIME_WINDOW_MS = 60 * 1000;
const MIN_REQUESTS_PER_MINUTE = 1;
const MAX_REQUESTS_PER_MINUTE = 10000;

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

export function createRateLimiter(
  requestsPerMinute: number,
  _options?: RateLimiterOptions,
): RateLimiter {
  validateRateLimiterParams(requestsPerMinute);

  let requestCount = 0;
  let lastRequestTime = Date.now();
  const timeWindow = DEFAULT_TIME_WINDOW_MS;
  let pending: Promise<void> = Promise.resolve();

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

    checkLimit(): Promise<void> {
      const admitted = pending.then(async () => {
        while (true) {
          const now = Date.now();
          if (now - lastRequestTime >= timeWindow) {
            requestCount = 0;
            lastRequestTime = now;
          }
          if (requestCount < requestsPerMinute) {
            requestCount++;
            return;
          }
          await new Promise(resolve => setTimeout(resolve, Math.max(1, lastRequestTime + timeWindow - now)));
        }
      });
      pending = admitted.catch(() => {});
      return admitted;
    },
  };
}
