/**
 * Summarizer interfaces module
 * Contains shared interfaces for the summarizer functionality
 * Follows Power of Ten guidelines for TypeScript
 * @module summarizer/interfaces
 */

/**
 * Interface for form values
 */
export interface FormValues {
  taskKey?: string;
  processId?: string;
  targetAudience: string;
  checkboxContent: string[];
  qualityProcess?: boolean;
  attemptNumber?: number;
  previousQualityId?: number;
}

/**
 * Interface for summarization response
 */
export interface SummarizationResponse {
  summary: string;
  systemMessage: string;
  processId?: string;
  qualityEvaluationId?: number;
  qualityScore?: number;
  qualityAttempts?: number;
  needsResubmission?: boolean;
  maxQualityAttempts?: number;
}

/**
 * Extends Window interface to include qualityEvaluationTimeout
 */
declare global {
  interface Window {
    qualityEvaluationTimeout: ReturnType<typeof setTimeout> | null;
  }
}
