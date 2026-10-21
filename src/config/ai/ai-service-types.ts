/**
 * AI Service Types Module
 * Defines shared interfaces and types used across AI services
 * @module config/ai/ai-service-types
 */

/**
 * Options for text processing
 */
export interface ProcessingOptions {
  taskKey?: string;
  taskPromptMode?: "rewritePlanDraft" | "sourceAnalysis";
  paragraphCount?: number | string;
  senderIntent?: string;
  repairInstructions?: string;
  targetAudience: string;
  checkboxContent: string | string[];
  requestId?: string;
  processId?: string;
  qualityProcess?: boolean;
  attemptNumber?: number;
  previousQualityId?: number;
  rewritePlanDraft?: string;
  rewritePlanEnabled?: boolean;
  reasoningEnabled?: boolean;
  webSearchMode?: "inherit" | "off" | "on";
  aiCallPurpose?: "task" | "background";
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Result of text processing
 */
export interface ProcessingResult {
  summary: string;
  systemMessage: string;
}

/**
 * Result of error handling during API calls
 */
export interface ErrorHandlingResult {
  shouldRetry: boolean;
  error?: Error;
}

/**
 * Interface for quality evaluation results
 */
export interface QualityEvaluationResult {
  score: string;
  feedback?: string;
}
