/**
 * AI Limits Configuration Module
 * Defines rate limiting and resource constraints for AI providers
 * @module config/ai/ai-limits
 */

import { assert } from "../../utils/safety-utils.js";
import type { AIProvider } from "./ai-config.js";

/**
 * Interface for AI rate limiting configuration
 */
export interface RateLimitingConfig {
  REQUESTS_PER_MINUTE: number;
  MAX_CONCURRENT_REQUESTS: number;
  RETRY_COEFFICIENT: number; // Multiplier for progressive backoff
}

/**
 * Interface for AI resource limits configuration
 */
export interface ResourceLimitsConfig {
  MAX_TEXT_LENGTH: number; // Maximum text length in characters
  TIMEOUT_MS: number; // Request timeout in milliseconds
  MAX_PROCESSING_TIME_MS: number; // Maximum processing time in milliseconds
}

/**
 * Rate limiting configuration for AI providers
 * Need more configs for other models and providers.
 */
export const RATE_LIMITS: Readonly<Record<AIProvider, RateLimitingConfig>> =
  Object.freeze({
    "gemini-2.5-flash": {
      REQUESTS_PER_MINUTE: 10,
      MAX_CONCURRENT_REQUESTS: 10,
      RETRY_COEFFICIENT: 1.5,
    },
    openai: {
      REQUESTS_PER_MINUTE: 1000,
      MAX_CONCURRENT_REQUESTS: 50,
      RETRY_COEFFICIENT: 2.0,
    },
  });

/**
 * Resource limits configuration for AI providers
 */
export const RESOURCE_LIMITS: Readonly<
  Record<AIProvider, ResourceLimitsConfig>
> = Object.freeze({
  "gemini-2.5-flash": {
    MAX_TEXT_LENGTH: 1024 * 1024, // 1MB text input
    TIMEOUT_MS: 120000, // 2 minutes
    MAX_PROCESSING_TIME_MS: 300000, // 5 minutes
  },
  openai: {
    MAX_TEXT_LENGTH: 512 * 1024, // 512KB text input
    TIMEOUT_MS: 90000, // 1.5 minutes
    MAX_PROCESSING_TIME_MS: 240000, // 4 minutes
  },
});

/**
 * Gets the rate limiting configuration for a provider
 * @param provider - AI provider to get limits for
 * @returns Rate limiting configuration
 */
export function getRateLimits(provider: AIProvider): RateLimitingConfig {
  assert(
    RATE_LIMITS[provider] !== undefined,
    `Rate limits not defined for provider: ${provider}`,
  );

  return RATE_LIMITS[provider];
}

/**
 * Gets the resource limits configuration for a provider
 * @param provider - AI provider to get limits for
 * @returns Resource limits configuration
 */
export function getResourceLimits(provider: AIProvider): ResourceLimitsConfig {
  assert(
    RESOURCE_LIMITS[provider] !== undefined,
    `Resource limits not defined for provider: ${provider}`,
  );

  return RESOURCE_LIMITS[provider];
}

/**
 * Validates all limit configurations at runtime
 * @throws Error if any critical limits are invalid
 */
export function validateLimits(): void {
  // Validate rate limits
  Object.entries(RATE_LIMITS).forEach(([provider, limits]) => {
    assert(
      limits.REQUESTS_PER_MINUTE > 0,
      `REQUESTS_PER_MINUTE must be positive for provider ${provider}`,
    );
    assert(
      limits.MAX_CONCURRENT_REQUESTS > 0,
      `MAX_CONCURRENT_REQUESTS must be positive for provider ${provider}`,
    );
    assert(
      limits.RETRY_COEFFICIENT >= 1.0,
      `RETRY_COEFFICIENT must be at least 1.0 for provider ${provider}`,
    );
  });

  // Validate resource limits
  Object.entries(RESOURCE_LIMITS).forEach(([provider, limits]) => {
    assert(
      limits.MAX_TEXT_LENGTH > 0,
      `MAX_TEXT_LENGTH must be positive for provider ${provider}`,
    );
    assert(
      limits.TIMEOUT_MS > 0,
      `TIMEOUT_MS must be positive for provider ${provider}`,
    );
    assert(
      limits.MAX_PROCESSING_TIME_MS > 0,
      `MAX_PROCESSING_TIME_MS must be positive for provider ${provider}`,
    );
  });
}
