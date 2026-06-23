import { readIntegerEnv } from "./read-env.js";

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

export type ApiRateLimitConfig = {
  windowMs: number;
  standard: number;
  progress: number;
  quality: number;
  summarize: number;
  fileUpload: number;
};

export type SecurityConfig = {
  maxFileSize: string;
  maxFileSizeMB: number;
  rateLimit: RateLimitConfig;
  apiRateLimit: ApiRateLimitConfig;
};

export const securityConfig: SecurityConfig = {
  maxFileSize: "50mb",
  maxFileSizeMB: readIntegerEnv("maxFileSize", 50, 1),
  rateLimit: {
    windowMs: readIntegerEnv("API_GLOBAL_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, 1000),
    max: readIntegerEnv("API_GLOBAL_RATE_LIMIT_MAX", 100, 1),
  },
  apiRateLimit: {
    windowMs: readIntegerEnv("API_RATE_LIMIT_WINDOW_MS", 60 * 1000, 1000),
    standard: readIntegerEnv("API_RATE_LIMIT_STANDARD_MAX", 30, 1),
    progress: readIntegerEnv("API_RATE_LIMIT_PROGRESS_MAX", 240, 1),
    quality: readIntegerEnv("API_RATE_LIMIT_QUALITY_MAX", 10, 1),
    summarize: readIntegerEnv("API_RATE_LIMIT_SUMMARIZE_MAX", 10, 1),
    fileUpload: readIntegerEnv("API_RATE_LIMIT_FILE_UPLOAD_MAX", 5, 1),
  },
};
