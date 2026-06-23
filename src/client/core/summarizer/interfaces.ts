/**
 * Summarizer interfaces module
 * Contains shared interfaces for the summarizer functionality
 * @module summarizer/interfaces
 */

export type FormValues = {
  taskKey?: string;
  processId?: string;
  targetAudience: string;
  checkboxContent: string[];
  qualityProcess?: boolean;
  attemptNumber?: number;
  previousQualityId?: number;
};

export type SummarizationResponse = {
  summary: string;
  systemMessage: string;
  processId?: string;
  qualityEvaluationId?: number;
  qualityScore?: number;
  qualityAttempts?: number;
  needsResubmission?: boolean;
  maxQualityAttempts?: number;
};
