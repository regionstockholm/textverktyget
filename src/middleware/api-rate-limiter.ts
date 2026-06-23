/**
 * API Rate Limiter Middleware
 *
 * Provides rate limiting for general API endpoints with environment-specific configurations.
 */

"use strict";

import type { NextFunction, Request, Response } from "express";
import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import { timeLimits } from "../config/shared-config.js";
import { config } from "../config/app-config.js";
import configService from "../services/config/config-service.js";
import { readRuntimeInteger } from "../utils/runtime-number.js";

// Extend Express Request interface to include rateLimit only (session removed)
declare module "express" {
  interface Request {
    rateLimit?: {
      resetTime: Date | number;
      remaining?: number;
      limit?: number;
    };
  }
}

/**
 * Error messages for rate limiting
 * @constant {Object}
 */
const ERROR_MESSAGES = Object.freeze({
  API: "För många förfrågningar. Vänligen försök igen om en minut.",
});

/**
 * Maximum allowed rate limit value
 */

/**
 * Calculates remaining time for rate limit reset
 *
 * @param {Date|number} resetTime - Time when the rate limit resets
 * @returns {number} Remaining time in seconds
 */
function calculateRemainingTime(resetTime: Date | number): number {
  const remainingMs = Number(resetTime) - Date.now();
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  return Math.max(0, remainingSeconds);
}

/**
 * Creates a rate limit handler function
 *
 * @param {string} errorMessage - Error message to display
 * @returns {Function} Handler function for rate limiter
 */
function createRateLimitHandler(
  errorMessage: string,
): (req: Request, res: Response) => void {
  return (req: Request, res: Response): void => {
    const remainingTime = calculateRemainingTime(req.rateLimit?.resetTime || 0);

    res.status(429).json({
      error: errorMessage,
      remainingTime,
    });
  };
}

/**
 * Creates API rate limiter configuration
 *
 * @returns {Object} Rate limiter configuration for API
 */
function createApiLimiterConfig(): any {
  const windowMs = resolvedGlobalRateLimit.windowMs;
  const remainingTimeSeconds = Math.ceil(windowMs / 1000);

  return {
    windowMs,
    max: resolvedGlobalRateLimit.max,
    message: {
      error: ERROR_MESSAGES.API,
      remainingTime: remainingTimeSeconds,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimitHandler(ERROR_MESSAGES.API),
    // Rate limiting applies to all requests now (no authentication to skip)
    skip: (): boolean => false,
    // Don't trust proxies for local development
    trustProxy: false,
  };
}

type GlobalRateLimitConfig = {
  windowMs: number;
  max: number;
};

const RUNTIME_REFRESH_MS = 15000;
let resolvedGlobalRateLimit: GlobalRateLimitConfig = {
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
};
let globalRateLimitFetchedAt = 0;
let globalRateLimitRefreshPromise: Promise<void> | null = null;
let globalLimiterKey = "";
let globalLimiter: RateLimitRequestHandler | null = null;

export function resolveRuntimeGlobalRateLimit(
  runtimeSettings: unknown,
): GlobalRateLimitConfig {
  const defaults: GlobalRateLimitConfig = {
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.max,
  };

  const runtimeConfig =
    runtimeSettings && typeof runtimeSettings === "object"
      ? (runtimeSettings as Record<string, unknown>).globalRateLimit
      : undefined;
  if (!runtimeConfig || typeof runtimeConfig !== "object") {
    return defaults;
  }

  const raw = runtimeConfig as Record<string, unknown>;
  return {
    windowMs: readRuntimeInteger(
      raw.windowMs,
      defaults.windowMs,
      1000,
      60 * 60 * 1000,
    ),
    max: readRuntimeInteger(raw.max, defaults.max, 1, timeLimits.maxRateLimit),
  };
}

async function refreshGlobalRateLimitConfig(): Promise<void> {
  const now = Date.now();
  if (now - globalRateLimitFetchedAt < RUNTIME_REFRESH_MS) {
    return;
  }

  if (globalRateLimitRefreshPromise) {
    return globalRateLimitRefreshPromise;
  }

  globalRateLimitRefreshPromise = (async () => {
    try {
      const runtimeSettings = await configService.getRuntimeSettings();
      resolvedGlobalRateLimit = resolveRuntimeGlobalRateLimit(runtimeSettings);
      globalRateLimitFetchedAt = Date.now();
    } catch {
      globalRateLimitFetchedAt = Date.now();
    } finally {
      globalRateLimitRefreshPromise = null;
    }
  })();

  return globalRateLimitRefreshPromise;
}

function getDynamicApiLimiter(): RateLimitRequestHandler {
  const key = `${resolvedGlobalRateLimit.windowMs}:${resolvedGlobalRateLimit.max}`;
  if (globalLimiter && globalLimiterKey === key) {
    return globalLimiter;
  }

  const limiterConfig = createApiLimiterConfig();
  logRateLimiterConfig("API", limiterConfig);
  globalLimiter = rateLimit(limiterConfig);
  globalLimiterKey = key;
  return globalLimiter;
}

/**
 * Logs rate limiter configuration for debugging
 *
 * @param {string} name - Name of the rate limiter
 * @param {any} config - Rate limiter configuration
 */
function logRateLimiterConfig(name: string, rateLimiterConfig: any): void {
  console.log(`[API Rate Limiter] ${name} configuration:`, {
    windowMs: rateLimiterConfig.windowMs,
    max: rateLimiterConfig.max,
    trustProxy: rateLimiterConfig.trustProxy,
  });
}

/**
 * General API rate limiter
 * Uses base rate limit from environment config
 * Simple control flow, assertions
 */
export const apiLimiter = ((
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  void refreshGlobalRateLimitConfig()
    .then(() => {
      const limiter = getDynamicApiLimiter();
      limiter(req, res, next);
    })
    .catch(() => {
      const fallbackConfig = {
        ...createApiLimiterConfig(),
        windowMs: config.security.rateLimit.windowMs,
        max: config.security.rateLimit.max,
      };
      const fallbackLimiter = rateLimit(fallbackConfig);
      fallbackLimiter(req, res, next);
    });
}) as unknown as RateLimitRequestHandler;

/**
 * Middleware to log CSP violations
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const cspViolationReporter = (req: Request, res: Response): void => {
  if (req.body) {
    console.error("CSP Violation:", req.body);
  }

  res.status(204).end();
};
