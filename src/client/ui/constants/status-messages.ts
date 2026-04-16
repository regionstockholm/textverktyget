/**
 * Status Messages Constants
 * Centralized configuration for user-facing status messages
 * Easy to modify for different languages or messaging preferences
 *
 * @module ui/constants/status-messages
 */

/**
 * Processing state types
 * Currently only PROCESSING is used since quality evaluation happens instantly on backend
 */
export enum ProcessingState {
  /** Text processing/summarization (includes backend quality evaluation) */
  PROCESSING = "processing",
}

export enum ProcessingStage {
  QUEUED = "queued",
  ANALYSIS = "analysis",
  REWRITE_DRAFT = "rewrite_draft",
  TASK_EXECUTION = "task_execution",
  TASK_SHAPING = "task_shaping",
  QUALITY_EVALUATION = "quality_evaluation",
  QUALITY_REPAIR = "quality_repair",
  FINALIZING = "finalizing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Status message templates
 * Customize these messages to change user-facing text
 *
 * Variables:
 * - {attempt}: Current attempt number (e.g., 1, 2, 3)
 * - {maxAttempts}: Maximum number of attempts (e.g., 5)
 *
 * Note: Quality evaluation happens on backend and is instant,
 * so we just show "Bearbetar texten" throughout all attempts
 */
export const STATUS_MESSAGES = {
  /**
   * Message shown during text processing
   * Swedish: "Bearbetar texten, försök X av Y..."
   * Used for all attempts including quality evaluation retries
   */
  [ProcessingState.PROCESSING]:
    "Bearbetar texten, försök {attempt} av {maxAttempts}...",

  /**
   * Default message when no attempt information is available
   * Swedish: "Bearbetar text..."
   */
  DEFAULT: "Bearbetar texten...",
} as const;

export const STAGE_MESSAGES: Record<ProcessingStage, string> = {
  [ProcessingStage.QUEUED]: "Ställer i kö",
  [ProcessingStage.ANALYSIS]: "Sammanfattar det viktigaste",
  [ProcessingStage.REWRITE_DRAFT]: "Tar fram omskrivningsutkast",
  [ProcessingStage.TASK_EXECUTION]: "Genomför uppgiften",
  [ProcessingStage.TASK_SHAPING]: "Förfinar struktur och ordning",
  [ProcessingStage.QUALITY_EVALUATION]: "Granskar resultatet",
  [ProcessingStage.QUALITY_REPAIR]: "Gör justeringar",
  [ProcessingStage.FINALIZING]: "Slutför bearbetningen",
  [ProcessingStage.COMPLETED]: "Klart",
  [ProcessingStage.FAILED]: "Bearbetningen misslyckades",
  [ProcessingStage.CANCELLED]: "Bearbetningen avbröts",
};

/**
 * Formats a status message with attempt information
 * @param state - The current processing state
 * @param attemptNumber - Current attempt number
 * @param maxAttempts - Maximum number of attempts
 * @returns Formatted status message
 */
export function formatStatusMessage(
  state: ProcessingState,
  attemptNumber: number,
  maxAttempts: number,
): string {
  const template = STATUS_MESSAGES[state];

  return template
    .replace("{attempt}", String(attemptNumber))
    .replace("{maxAttempts}", String(maxAttempts));
}

/**
 * Gets the default status message
 * @returns Default status message
 */
export function getDefaultStatusMessage(): string {
  return STATUS_MESSAGES.DEFAULT;
}

export function formatStageStatusMessage(
  stageMessage: string,
  attemptNumber: number,
  maxAttempts: number,
): string {
  const normalizedStage = stageMessage.trim().replace(/[\.\s]+$/, "");
  return `${normalizedStage}, försök ${attemptNumber} av ${maxAttempts}...`;
}
