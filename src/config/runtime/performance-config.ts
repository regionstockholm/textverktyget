import { readBooleanEnv, readIntegerEnv } from "./read-env.js";

export type SummarizeQueueConfig = {
  maxConcurrentJobs: number;
  maxQueueSize: number;
  maxWaitMs: number;
  retryAfterSeconds: number;
};

export type PerformanceConfig = {
  maxTextLength: number;
  maxChunks: number;
  summarizeQueue: SummarizeQueueConfig;
  urlFetchTimeoutMs: number;
  urlFetchMaxRedirects: number;
  urlFetchMaxResponseBytes: number;
  urlFetchAllowPrivateNetwork: boolean;
};

export const performanceConfig: PerformanceConfig = {
  maxTextLength: Number.parseInt(
    process.env.MAX_TEXT_LENGTH || String(5 * 1024 * 1024),
    10,
  ),
  maxChunks: readIntegerEnv("MAX_TEXT_CHUNKS", 10, 1, 100),
  summarizeQueue: {
    maxConcurrentJobs: readIntegerEnv("SUMMARIZE_MAX_CONCURRENT_JOBS", 8, 1, 200),
    maxQueueSize: readIntegerEnv("SUMMARIZE_MAX_QUEUE_SIZE", 200, 1, 5000),
    maxWaitMs: readIntegerEnv("SUMMARIZE_MAX_QUEUE_WAIT_MS", 45000, 1000),
    retryAfterSeconds: readIntegerEnv("SUMMARIZE_RETRY_AFTER_SECONDS", 15, 1, 300),
  },
  urlFetchTimeoutMs: readIntegerEnv("URL_FETCH_TIMEOUT_MS", 10000, 1000),
  urlFetchMaxRedirects: readIntegerEnv("URL_FETCH_MAX_REDIRECTS", 3, 0, 10),
  urlFetchMaxResponseBytes: readIntegerEnv(
    "URL_FETCH_MAX_RESPONSE_BYTES",
    2 * 1024 * 1024,
    16 * 1024,
    20 * 1024 * 1024,
  ),
  urlFetchAllowPrivateNetwork: readBooleanEnv("URL_FETCH_ALLOW_PRIVATE_NETWORK", false),
};
