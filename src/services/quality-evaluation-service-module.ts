/**
 * Quality Evaluator Service Module
 * Keeps the historical service import path while delegating provider selection
 * to the central AI service factory.
 */

import { getQualityScore as getConfiguredQualityScore } from "../config/ai/ai-service-factory.js";

/**
 * Evaluates the quality of processed text using the current AI provider
 * @param evaluationPrompt - The complete evaluation prompt with original text, processed text, and prompt
 * @returns Promise resolving to the quality score as a string
 */
export async function getQualityScore(
  evaluationPrompt: string,
  trace?: { requestId?: string; processId?: string },
): Promise<string> {
  return await getConfiguredQualityScore(evaluationPrompt, trace);
}
