/**
 * API Rate Limiting Utilities Module
 * Provides standardized rate limiters for API routes
 */

import { rateLimit, Options } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { config } from "../../config/app-config.js";
import configService from "../../services/config/config-service.js";
import { readRuntimeInteger } from "../runtime-number.js";

type RuntimeApiRateLimitConfig = {
  windowMs: number;
  standard: number;
  progress: number;
  quality: number;
  summarize: number;
  fileUpload: number;
};

const RUNTIME_REFRESH_MS = 15000;

let runtimeRateLimitConfig: RuntimeApiRateLimitConfig = {
  windowMs: config.security.apiRateLimit.windowMs,
  standard: config.security.apiRateLimit.standard,
  progress: config.security.apiRateLimit.progress,
  quality: config.security.apiRateLimit.quality,
  summarize: config.security.apiRateLimit.summarize,
  fileUpload: config.security.apiRateLimit.fileUpload,
};
let runtimeRateLimitFetchedAt = 0;
let runtimeRateLimitRefreshPromise: Promise<void> | null = null;

type RateLimiterKind = keyof RuntimeApiRateLimitConfig;

type LimiterRegistry = {
  [K in Exclude<RateLimiterKind, "windowMs">]: {
    key: string;
    handler: ReturnType<typeof rateLimit>;
  };
};

const limiterRegistry: LimiterRegistry = {
  standard: {
    key: "",
    handler: createApiRateLimiter(
      runtimeRateLimitConfig.windowMs,
      runtimeRateLimitConfig.standard,
      "Too many API requests, please try again later",
    ),
  },
  quality: {
    key: "",
    handler: createApiRateLimiter(
      runtimeRateLimitConfig.windowMs,
      runtimeRateLimitConfig.quality,
      "Too many quality evaluation requests, please try again later",
    ),
  },
  progress: {
    key: "",
    handler: createApiRateLimiter(
      runtimeRateLimitConfig.windowMs,
      runtimeRateLimitConfig.progress,
      "Too many progress requests, please try again later",
    ),
  },
  summarize: {
    key: "",
    handler: createApiRateLimiter(
      runtimeRateLimitConfig.windowMs,
      runtimeRateLimitConfig.summarize,
      "Too many summarization requests, please try again later",
    ),
  },
  fileUpload: {
    key: "",
    handler: createApiRateLimiter(
      runtimeRateLimitConfig.windowMs,
      runtimeRateLimitConfig.fileUpload,
      "Too many file upload requests, please try again later",
    ),
  },
};

/**
 * Default message for rate-limited requests
 */
const DEFAULT_RATE_LIMIT_MESSAGE = "Too many requests, please try again later";

export function resolveRuntimeApiRateLimitConfig(
  runtimeSettings: unknown,
): RuntimeApiRateLimitConfig {
  const defaults: RuntimeApiRateLimitConfig = {
    windowMs: config.security.apiRateLimit.windowMs,
    standard: config.security.apiRateLimit.standard,
    progress: config.security.apiRateLimit.progress,
    quality: config.security.apiRateLimit.quality,
    summarize: config.security.apiRateLimit.summarize,
    fileUpload: config.security.apiRateLimit.fileUpload,
  };

  const runtimeConfig =
    runtimeSettings && typeof runtimeSettings === "object"
      ? (runtimeSettings as Record<string, unknown>).apiRateLimit
      : undefined;

  if (!runtimeConfig || typeof runtimeConfig !== "object") {
    return defaults;
  }

  const runtimeRateLimit = runtimeConfig as Record<string, unknown>;
  return {
    windowMs: readRuntimeInteger(runtimeRateLimit.windowMs, defaults.windowMs, 1000, 60 * 60 * 1000),
    standard: readRuntimeInteger(runtimeRateLimit.standard, defaults.standard, 1, 10000),
    progress: readRuntimeInteger(runtimeRateLimit.progress, defaults.progress, 1, 10000),
    quality: readRuntimeInteger(runtimeRateLimit.quality, defaults.quality, 1, 10000),
    summarize: readRuntimeInteger(runtimeRateLimit.summarize, defaults.summarize, 1, 10000),
    fileUpload: readRuntimeInteger(runtimeRateLimit.fileUpload, defaults.fileUpload, 1, 10000),
  };
}

async function refreshRuntimeRateLimitConfig(): Promise<void> {
  const now = Date.now();
  if (now - runtimeRateLimitFetchedAt < RUNTIME_REFRESH_MS) {
    return;
  }

  if (runtimeRateLimitRefreshPromise) {
    return runtimeRateLimitRefreshPromise;
  }

  runtimeRateLimitRefreshPromise = (async () => {
    try {
      const runtimeSettings = await configService.getRuntimeSettings();
      runtimeRateLimitConfig = resolveRuntimeApiRateLimitConfig(runtimeSettings);
      runtimeRateLimitFetchedAt = Date.now();
    } catch {
      runtimeRateLimitFetchedAt = Date.now();
    } finally {
      runtimeRateLimitRefreshPromise = null;
    }
  })();

  return runtimeRateLimitRefreshPromise;
}

function getOrCreateLimiter(
  kind: Exclude<RateLimiterKind, "windowMs">,
  message: string,
): ReturnType<typeof rateLimit> {
  const windowMs = runtimeRateLimitConfig.windowMs;
  const max = runtimeRateLimitConfig[kind];
  const key = `${windowMs}:${max}`;
  const existing = limiterRegistry[kind];
  if (existing.key === key) {
    return existing.handler;
  }

  const handler = createApiRateLimiter(windowMs, max, message);
  limiterRegistry[kind] = { key, handler };
  return handler;
}

function createDynamicRateLimiter(
  kind: Exclude<RateLimiterKind, "windowMs">,
  message: string,
): ReturnType<typeof rateLimit> {
  const fallback = createApiRateLimiter(
    config.security.apiRateLimit.windowMs,
    config.security.apiRateLimit[kind],
    message,
  );

  const middleware = ((req: Request, res: Response, next: NextFunction) => {
    void refreshRuntimeRateLimitConfig()
      .then(() => {
        const handler = getOrCreateLimiter(kind, message);
        handler(req, res, next);
      })
      .catch(() => {
        fallback(req, res, next);
      });
  }) as unknown as ReturnType<typeof rateLimit>;

  return middleware;
}

/**
 * Creates a standard API rate limiter with custom configuration
 *
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum number of requests in window
 * @param {string} message - Error message
 * @returns {ReturnType<typeof rateLimit>} Configured rate limiter middleware
 */
export function createApiRateLimiter(
  windowMs: number = 60 * 1000, // Default: 1 minute
  max: number = 30, // Default: 30 requests per minute
  message: string = DEFAULT_RATE_LIMIT_MESSAGE,
): ReturnType<typeof rateLimit> {
  const options: Partial<Options> = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  };

  return rateLimit(options);
}

/**
 * Pre-configured rate limiters for common API operations
 */
export const rateLimiters = {
  // Standard API limiter
  standard: createDynamicRateLimiter(
    "standard",
    "Too many API requests, please try again later",
  ),

  // Progress polling limiter (higher threshold for frequent UX polling)
  progress: createDynamicRateLimiter(
    "progress",
    "Too many progress requests, please try again later",
  ),

  // Stricter limiter for resource-intensive operations like quality evaluation
  quality: createDynamicRateLimiter(
    "quality",
    "Too many quality evaluation requests, please try again later",
  ),

  // Stricter limiter for summarization
  summarize: createDynamicRateLimiter(
    "summarize",
    "Too many summarization requests, please try again later",
  ),

  // Stricter limiter for file uploads
  fileUpload: createDynamicRateLimiter(
    "fileUpload",
    "Too many file upload requests, please try again later",
  ),
};
