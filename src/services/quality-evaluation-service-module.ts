/**
 * Quality Evaluator Service Module
 * Handles text quality evaluation using different AI providers
 */

import { AI_PROVIDERS } from "../config/ai/ai-config.js";
import { assert } from "../utils/safety-utils.js";
import { getCurrentProvider } from "../config/ai/ai-service-factory.js";
import { logger } from "../utils/logger.js";

/**
 * Interface for OpenAI module with optional quality score function
 */
interface OpenAIModule {
  getSummary: (text: string, options: any) => Promise<string>;
  getQualityScore?: (
    evaluationPrompt: string,
    trace?: { requestId?: string; processId?: string },
  ) => Promise<string>;
}

/**
 * Evaluates the quality of processed text using the current AI provider
 * @param evaluationPrompt - The complete evaluation prompt with original text, processed text, and prompt
 * @returns Promise resolving to the quality score as a string
 */
export async function getQualityScore(
  evaluationPrompt: string,
  trace?: { requestId?: string; processId?: string },
): Promise<string> {
  assert(
    typeof evaluationPrompt === "string",
    "Evaluation prompt must be a string",
  );

  const provider = getCurrentProvider();

  try {
    logger.info("process.quality.started", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "running",
      meta: { provider },
    });

    // Import provider implementation based on the active runtime provider.
    if (provider === AI_PROVIDERS.GEMINI_2_5_FLASH) {
      const { getQualityScore } = await import(
        "../config/ai/providers/gemini.js"
      );
      return await getQualityScore(evaluationPrompt, trace);
    } else if (provider === AI_PROVIDERS.OPENAI) {
      // Implement OpenAI quality evaluation
      return await evaluateQualityWithOpenAI(evaluationPrompt, trace);
    } else {
      throw new Error(
        `Unsupported AI provider for quality evaluation: ${provider}`,
      );
    }
  } catch (error) {
    logger.error("process.failed", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "failed",
      meta: {
        reason: "quality_provider_error",
        provider,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error instanceof Error
      ? error
      : new Error(`Unknown error: ${String(error)}`);
  }
}

/**
 * Evaluates the quality of processed text using OpenAI
 * @param evaluationPrompt - The complete evaluation prompt with original text, processed text, and prompt
 * @returns Promise resolving to the quality score as a string
 * @private
 */
async function evaluateQualityWithOpenAI(
  evaluationPrompt: string,
  trace?: { requestId?: string; processId?: string },
): Promise<string> {
  try {
    // Import OpenAI service with proper typing
    const openaiModule = (await import(
      "../config/ai/providers/openai.js"
    )) as OpenAIModule;

    // Check if the OpenAI service has a getQualityScore function
    if (openaiModule.getQualityScore) {
      return await openaiModule.getQualityScore(evaluationPrompt, trace);
    }

    // If not, use the getSummary function as a fallback
    // This is a temporary solution until OpenAI service implements getQualityScore
    logger.warn("process.quality.fallback.openai_summary", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "running",
    });

    // Create a simple options object for the getSummary function
    const options = {
      paragraphCount: "1",
      targetAudience: "internal",
      checkboxContent: "concise",
    };

    // Use getSummary to evaluate quality
    const result = await openaiModule.getSummary(evaluationPrompt, options);

    // Validate that the result is a number between 1 and 10
    const score = parseInt(result.trim(), 10);
    if (isNaN(score) || score < 1 || score > 10) {
      throw new Error(`Invalid quality score received from OpenAI: ${result}`);
    }

    return result.trim();
  } catch (error) {
    logger.error("process.failed", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "failed",
      meta: {
        reason: "quality_openai_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error instanceof Error
      ? error
      : new Error(`Unknown error: ${String(error)}`);
  }
}
