/**
 * Unified Application Configuration
 * Simple, centralized configuration management
 */

import {
  MAX_ITERATIONS,
  MAX_TIMEOUT_DURATION,
  MAX_RATE_LIMIT,
  MAX_FILE_SIZE,
  MAX_FILES,
  ERROR_MESSAGE_TIMEOUT,
  MAX_TEXT_LENGTH,
  MIN_TEXT_LENGTH,
  MAX_ELEMENT_CHECKS,
  MAX_FILE_TYPES,
  safetyConfig,
  FileLimits,
  UILimits,
} from "./shared-config.js";

function readIntegerEnv(
  envKey: string,
  fallback: number,
  min: number,
  max?: number,
): number {
  const rawValue = process.env[envKey];
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  if (parsed < min) {
    return fallback;
  }

  if (typeof max === "number" && parsed > max) {
    return fallback;
  }

  return parsed;
}

function readBooleanEnv(envKey: string, fallback: boolean): boolean {
  const rawValue = process.env[envKey];
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
}

export const config = {
  // Environment flags
  isProduction: true,
  isDevelopment: false,
  isLocal: false,
  environment: "production",

  // Server configuration
  port: readIntegerEnv("PORT", 3000, 1, 65535),

  // Server settings (formerly env-config)
  serverSettings: {
    debug: false,
    errorDetails: false,
    cacheControl: "public, max-age=3600",
    secureCookies: false, // Set to true if using HTTPS
    trustProxy: 1,
    sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  },

  // API Keys
  apiKeys: {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  },

  // Database configuration (Postgres)
  database: {
    enabled: true,
    url: process.env.DATABASE_URL || "",
    sslMode: process.env.DATABASE_SSL_MODE || "",
  },

  // Security settings
  security: {
    maxFileSize: "50mb",
    maxFileSizeMB: readIntegerEnv("MAX_FILE_SIZE_MB", 50, 1),
    maxFilesPerUpload: readIntegerEnv("MAX_FILES_PER_UPLOAD", 1, 1, 20),
    rateLimit: {
      windowMs: readIntegerEnv(
        "API_GLOBAL_RATE_LIMIT_WINDOW_MS",
        15 * 60 * 1000,
        1000,
      ),
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
  },

  // Performance settings (Chapter 6: Prestanda)
  performance: {
    // Maximum text input length in characters (5MB = ~5 million chars)
    // Prevents gigabyte-sized texts from overwhelming the system
    maxTextLength: parseInt(
      process.env.MAX_TEXT_LENGTH || String(5 * 1024 * 1024),
      10,
    ),
    maxChunks: readIntegerEnv("MAX_TEXT_CHUNKS", 10, 1, 100),
    summarizeQueue: {
      maxConcurrentJobs: readIntegerEnv(
        "SUMMARIZE_MAX_CONCURRENT_JOBS",
        8,
        1,
        200,
      ),
      maxQueueSize: readIntegerEnv("SUMMARIZE_MAX_QUEUE_SIZE", 200, 1, 5000),
      maxWaitMs: readIntegerEnv("SUMMARIZE_MAX_QUEUE_WAIT_MS", 45000, 1000),
      sharedTokenTtlMs: readIntegerEnv(
        "SUMMARIZE_SHARED_TOKEN_TTL_MS",
        15 * 60 * 1000,
        60 * 1000,
      ),
      retryAfterSeconds: readIntegerEnv(
        "SUMMARIZE_RETRY_AFTER_SECONDS",
        15,
        1,
        300,
      ),
    },
    // External URL fetch timeout in milliseconds (default: 10 seconds)
    urlFetchTimeoutMs: readIntegerEnv("URL_FETCH_TIMEOUT_MS", 10000, 1000),
    // Maximum number of redirects for URL fetch (default: 3)
    urlFetchMaxRedirects: readIntegerEnv("URL_FETCH_MAX_REDIRECTS", 3, 0, 10),
    // Maximum response size in bytes for URL fetch (default: 2 MB)
    urlFetchMaxResponseBytes: readIntegerEnv(
      "URL_FETCH_MAX_RESPONSE_BYTES",
      2 * 1024 * 1024,
      16 * 1024,
      20 * 1024 * 1024,
    ),
    // Emergency override for private network fetch. Keep disabled by default.
    urlFetchAllowPrivateNetwork: readBooleanEnv(
      "URL_FETCH_ALLOW_PRIVATE_NETWORK",
      false,
    ),
  },

  // Feature flags
  features: {
    qualityEvaluation: true,
    fileUpload: true,
    webFetch: true,
    sharedLimiter: readBooleanEnv("LIMITER_SHARED_ENABLED", true),
  },

  // Quality Control Settings
  qualityControl: {
    // Maximum score that AI can return from quality evaluation (1-10 scale)
    maxScore: readIntegerEnv("QUALITY_MAX_SCORE", 10, 1, 10),
    // Minimum score threshold (scores below this are considered failures)
    minScore: readIntegerEnv("QUALITY_MIN_SCORE", 1, 1, 10),
    // Maximum number of quality evaluation retry attempts (default: 5)
    maxAttempts: readIntegerEnv("QUALITY_MAX_ATTEMPTS", 5, 1, 20),
    // Hours to keep completed quality records before purging (default: 6 hours)
    safePurgeHours: readIntegerEnv("QUALITY_PURGE_HOURS", 6, 1, 24 * 30),
    // Interval in minutes between purge runs (default: 1440 = once per day)
    purgeIntervalMinutes: readIntegerEnv(
      "QUALITY_PURGE_INTERVAL_MINUTES",
      1440,
      1,
      24 * 60,
    ),
  },

  resilience: {
    providerFallbackEnabled: readBooleanEnv("PROVIDER_FALLBACK_ENABLED", true),
    providerCircuitBreaker: {
      failureThreshold: readIntegerEnv(
        "PROVIDER_CB_FAILURE_THRESHOLD",
        5,
        1,
        100,
      ),
      cooldownMs: readIntegerEnv(
        "PROVIDER_CB_COOLDOWN_MS",
        30000,
        1000,
        10 * 60 * 1000,
      ),
    },
  },
};

/**
 * Validate essential configuration
 * @returns true if configuration is valid
 */
export function validateConfig(): boolean {
  // Check if at least one AI service is configured
  const hasAiService = !!(config.apiKeys.gemini || config.apiKeys.openai);

  if (!hasAiService) {
    console.warn(
      "No AI service configured. Add GEMINI_API_KEY or OPENAI_API_KEY to .env",
    );
  }

  if (!config.database.url) {
    console.warn("No DATABASE_URL configured. Add DATABASE_URL to .env");
  }

  if (!process.env.CONFIG_MASTER_KEY) {
    console.warn("No CONFIG_MASTER_KEY configured. Add CONFIG_MASTER_KEY to .env");
  }

  return true;
}

// Validate config on load
validateConfig();

// Re-export constants for server-side usage
export {
  MAX_ITERATIONS,
  MAX_TIMEOUT_DURATION,
  MAX_RATE_LIMIT,
  MAX_FILE_SIZE,
  MAX_FILES,
  ERROR_MESSAGE_TIMEOUT,
  MAX_TEXT_LENGTH,
  MIN_TEXT_LENGTH,
  MAX_ELEMENT_CHECKS,
  MAX_FILE_TYPES,
  safetyConfig,
  FileLimits,
  UILimits,
};
