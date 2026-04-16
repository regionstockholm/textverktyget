/**
 * AI Service Factory Module
 * Provides factory methods for accessing AI services
 * @module config/ai/ai-service-factory
 */

import {
  AI_PROVIDERS,
  type AIProvider,
  validateAIConfig,
  DEFAULT_PROVIDER,
} from "./ai-config.js";
import { validateLimits } from "./ai-limits.js";
import { assert } from "../../utils/safety-utils.js";
import { logger } from "../../utils/logger.js";
import configService from "../../services/config/config-service.js";
import { config as appConfig } from "../app-config.js";
import type {
  ProcessingOptions,
  ProcessingResult,
} from "./ai-service-types.js";

// Validate configuration on module import
validateAIConfig();
validateLimits();

/**
 * Gets the current AI provider from environment variables or default configuration
 * To change the provider across the entire application:
 * 1. Set the AI_PROVIDER environment variable, or
 * 2. Change the DEFAULT_PROVIDER constant in ai-config.ts
 *
 * @returns The current AI provider
 */
export function getCurrentProvider(): AIProvider {
  // Environment variable takes precedence over default configuration
  const provider = (process.env.AI_PROVIDER as AIProvider) || DEFAULT_PROVIDER;

  // Validate that the provider is supported
  assert(
    Object.values(AI_PROVIDERS).includes(provider),
    `Unsupported AI provider: ${provider}`,
  );

  return provider;
}

async function getConfiguredProvider(): Promise<AIProvider> {
  try {
    return await configService.getActiveProvider();
  } catch (error) {
    logger.warn("provider.config.load_failed", {
      processStatus: "running",
      meta: { reason: error instanceof Error ? error.message : "unknown" },
    });
    return getCurrentProvider();
  }
}

function getFallbackProvider(provider: AIProvider): AIProvider | null {
  if (provider === AI_PROVIDERS.GEMINI_2_5_FLASH) {
    return AI_PROVIDERS.OPENAI;
  }

  if (provider === AI_PROVIDERS.OPENAI) {
    return AI_PROVIDERS.GEMINI_2_5_FLASH;
  }

  return null;
}

function isTransientProviderError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const transientIndicators = [
    "rate limit",
    "quota",
    "timeout",
    "timed out",
    "network",
    "connection",
    "unavailable",
    "overloaded",
    "502",
    "503",
    "504",
    "429",
    "resource exhausted",
    "tillfälligt upptagen",
  ];

  return transientIndicators.some((indicator) => message.includes(indicator));
}

async function runSummaryWithProvider(
  provider: AIProvider,
  text: string,
  options: ProcessingOptions,
): Promise<ProcessingResult> {
  if (provider === AI_PROVIDERS.GEMINI_2_5_FLASH) {
    const { getSummary } = await import("./providers/gemini.js");
    return await getSummary(text, options);
  }

  if (provider === AI_PROVIDERS.OPENAI) {
    const { getSummary } = await import("./providers/openai.js");
    const summary = await getSummary(text, options);
    return {
      summary,
      systemMessage: "",
    };
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

async function runQualityWithProvider(
  provider: AIProvider,
  evaluationPrompt: string,
  trace?: { requestId?: string; processId?: string },
): Promise<string> {
  if (provider === AI_PROVIDERS.GEMINI_2_5_FLASH) {
    const { getQualityScore } = await import("./providers/gemini.js");
    return await getQualityScore(evaluationPrompt, trace);
  }

  if (provider === AI_PROVIDERS.OPENAI) {
    const { getQualityScore } = await import("./providers/openai.js");
    return await getQualityScore(evaluationPrompt, trace);
  }

  throw new Error(
    `Unsupported AI provider for quality evaluation: ${provider}`,
  );
}

/**
 * Gets a summary of the provided text using the current AI provider
 * @param text - Text to summarize
 * @param options - Processing options
 * @returns Summary of the text and the system message used
 */
export async function getSummary(
  text: string,
  options: ProcessingOptions,
): Promise<ProcessingResult> {
  assert(typeof text === "string", "Text must be a string");
  assert(text.trim().length > 0, "Text cannot be empty");
  assert(options !== undefined && options !== null, "Options are required");

  const provider = await getConfiguredProvider();
  const fallbackProvider = getFallbackProvider(provider);
  const fallbackEnabled = appConfig.resilience.providerFallbackEnabled;
  const requestId = options.requestId;
  const processId = options.processId || options.requestId;

  try {
    logger.debug("process.ai.provider.selected", {
      requestId,
      processId,
      processStatus: "running",
      meta: { provider },
    });

    return await runSummaryWithProvider(provider, text, options);
  } catch (error) {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(`Unknown error: ${String(error)}`);

    const shouldFallback =
      fallbackEnabled &&
      fallbackProvider !== null &&
      isTransientProviderError(normalizedError);

    if (shouldFallback) {
      logger.warn("process.ai.provider.fallback", {
        requestId,
        processId,
        processStatus: "running",
        meta: {
          fromProvider: provider,
          toProvider: fallbackProvider,
          reason: normalizedError.message,
        },
      });

      try {
        return await runSummaryWithProvider(fallbackProvider, text, options);
      } catch (fallbackError) {
        logger.error("process.failed", {
          requestId,
          processId,
          processStatus: "failed",
          meta: {
            reason: "ai_summary_fallback_failed",
            provider,
            fallbackProvider,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : "Unknown fallback error",
          },
        });
        throw fallbackError instanceof Error
          ? fallbackError
          : new Error(`Unknown fallback error: ${String(fallbackError)}`);
      }
    }

    logger.error("process.failed", {
      requestId,
      processId,
      processStatus: "failed",
      meta: {
        reason: "ai_summary_failed",
        provider,
        error: normalizedError.message,
      },
    });
    throw normalizedError;
  }
}

/**
 * Gets a quality evaluation for the provided prompt using the current AI provider
 * @param evaluationPrompt - Evaluation prompt
 * @returns Quality score
 */
export async function getQualityScore(
  evaluationPrompt: string,
  trace?: { requestId?: string; processId?: string },
): Promise<string> {
  assert(
    typeof evaluationPrompt === "string",
    "Evaluation prompt must be a string",
  );
  assert(
    evaluationPrompt.trim().length > 0,
    "Evaluation prompt cannot be empty",
  );

  const provider = await getConfiguredProvider();
  const fallbackProvider = getFallbackProvider(provider);
  const fallbackEnabled = appConfig.resilience.providerFallbackEnabled;

  try {
    logger.debug("process.quality.provider.selected", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "running",
      meta: { provider },
    });

    return await runQualityWithProvider(provider, evaluationPrompt, trace);
  } catch (error) {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(`Unknown error in quality evaluation: ${String(error)}`);

    const shouldFallback =
      fallbackEnabled &&
      fallbackProvider !== null &&
      isTransientProviderError(normalizedError);

    if (shouldFallback) {
      logger.warn("process.quality.provider.fallback", {
        requestId: trace?.requestId,
        processId: trace?.processId,
        processStatus: "running",
        meta: {
          fromProvider: provider,
          toProvider: fallbackProvider,
          reason: normalizedError.message,
        },
      });

      try {
        return await runQualityWithProvider(
          fallbackProvider,
          evaluationPrompt,
          trace,
        );
      } catch (fallbackError) {
        logger.error("process.failed", {
          requestId: trace?.requestId,
          processId: trace?.processId,
          processStatus: "failed",
          meta: {
            reason: "ai_quality_fallback_failed",
            provider,
            fallbackProvider,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : "Unknown fallback error",
          },
        });
        throw fallbackError instanceof Error
          ? fallbackError
          : new Error(`Unknown fallback error: ${String(fallbackError)}`);
      }
    }

    logger.error("process.failed", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "failed",
      meta: {
        reason: "ai_quality_failed",
        provider,
        error: normalizedError.message,
      },
    });
    throw normalizedError;
  }
}
