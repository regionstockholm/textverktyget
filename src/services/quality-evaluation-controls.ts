/**
 * Text Quality Control Service
 * Handles database operations for the text_quality_control table
 *
 * @module services/textQualityControl
 */

import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../config/database/db-connection.js";
import {
  executeInsert,
  executeUpdate,
  executeQuerySingle,
  executeDelete,
} from "../config/database/db-queries.js";
import { getQualityScore } from "./quality-evaluation-service-module.js";
import { config } from "../config/app-config.js";
import {
  prepareEvaluationPrompt,
  type QualityEvaluationContext,
} from "./quality-evaluation-prompt-builder.js";
import { logger } from "../utils/logger.js";
import configService from "./config/config-service.js";
import {
  type QualityReportArtifact,
  validateQualityReportArtifact,
} from "./summarize/pipeline-artifacts.js";

/**
 * Interface for text quality control records
 */
export interface TextQualityRecord {
  id: number;
  session_id: string;
  original_text: string;
  processed_text: string;
  prompt_used: string | null;
  processing_options: string | null;
  rewrite_plan_draft: string | null;
  score: number | null;
  iteration: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Gets quality control configuration from environment variables
 *
 * @returns Quality control configuration object
 */
function getQualityConfig() {
  return {
    // Environment-configurable values
    MIN_SCORE: config.qualityControl.minScore,
    MAX_SCORE: config.qualityControl.maxScore,
    SAFE_PURGE_HOURS: config.qualityControl.safePurgeHours,
    PURGE_INTERVAL_MINUTES: config.qualityControl.purgeIntervalMinutes,

    // Static values that don't need environment configuration
    DEFAULT_ITERATION: 1,
    DEFAULT_STATUS: "pending" as const,
    STATUS_PROCESSING: "processing" as const,
    STATUS_COMPLETED: "completed" as const,
    STATUS_FAILED: "failed" as const,
  };
}

/**
 * Quality control constants - now sourced from environment
 * Use getQualityConfig() for environment-aware values
 */
const QUALITY_CONSTANTS = getQualityConfig();

/**
 * Validates text quality input parameters
 * @param originalText Original text content
 * @param processedText Processed text content
 */
function validateTextInput(originalText: string, processedText: string): void {
  if (!originalText || typeof originalText !== "string") {
    throw new Error("Original text must be a non-empty string");
  }

  if (!processedText || typeof processedText !== "string") {
    throw new Error("Processed text must be a non-empty string");
  }
}

/**
 * Validates score input parameter
 * @param score Quality score to validate
 */
function validateScore(score: number): void {
  if (typeof score !== "number" || isNaN(score)) {
    throw new Error("Score must be a valid number");
  }

  if (
    score < QUALITY_CONSTANTS.MIN_SCORE ||
    score > QUALITY_CONSTANTS.MAX_SCORE
  ) {
    throw new Error(
      `Score must be between ${QUALITY_CONSTANTS.MIN_SCORE} and ${QUALITY_CONSTANTS.MAX_SCORE}`,
    );
  }
}

/**
 * Validates record ID parameter
 * @param recordId Record ID to validate
 */
function validateRecordId(recordId: number): void {
  if (!recordId || typeof recordId !== "number" || recordId <= 0) {
    throw new Error("Record ID must be a positive number");
  }
}

/**
 * Logs text processing operation details
 * @param sessionId Session identifier
 * @param originalText Original text content
 * @param processedText Processed text content
 * @param promptUsed Optional prompt used
 */
interface ProcessTrace {
  requestId?: string;
  processId?: string;
}

/**
 * Stores text processing data in the quality control database
 * @param originalText The original text before processing
 * @param processedText The processed text after AI transformation
 * @param promptUsed The prompt template used for processing
 * @param processingOptions Optional processing options to store (taskKey, paragraphCount, etc.)
 * @returns Promise resolving to the record ID if successful, false otherwise
 */
export async function storeTextQualityData(
  originalText: string,
  processedText: string,
  promptUsed?: string,
  processingOptions?: Record<string, unknown>,
  rewritePlanDraft?: string,
): Promise<number | false> {
  try {
    validateTextInput(originalText, processedText);

    const sessionId = uuidv4();
    const trace: ProcessTrace = {
      requestId:
        typeof processingOptions?.requestId === "string"
          ? (processingOptions.requestId as string)
          : undefined,
      processId:
        typeof processingOptions?.processId === "string"
          ? (processingOptions.processId as string)
          : undefined,
    };

    // Serialize processing options to JSON
    const processingOptionsJson = processingOptions
      ? JSON.stringify(processingOptions)
      : null;
    if (processingOptionsJson) {
      logger.debug("process.quality.options.stored", {
        ...trace,
        processStatus: "running",
      });
    }

    const db = await getDatabase();
    const insertQuery = `
      INSERT INTO text_quality_control (
        session_id, 
        original_text, 
        processed_text, 
        prompt_used,
        processing_options,
        rewrite_plan_draft,
        iteration, 
        status
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      sessionId,
      originalText,
      processedText,
      promptUsed || null,
      processingOptionsJson,
      rewritePlanDraft || null,
      QUALITY_CONSTANTS.DEFAULT_ITERATION,
      QUALITY_CONSTANTS.DEFAULT_STATUS,
    ];

    const recordId = await executeInsert(db, insertQuery, values);
    logger.debug("process.quality.record.stored", {
      ...trace,
      processStatus: "running",
      meta: { recordId, sessionId },
    });
    return recordId;
  } catch (error) {
    logger.error("process.failed", {
      processStatus: "failed",
      meta: {
        reason: "quality_store_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return false;
  }
}

/**
 * Updates the quality score for a text quality control record
 * @param recordId The ID of the record to update
 * @param score The quality score (1-10)
 * @returns Promise resolving to true if successful
 */
export async function updateQualityScore(
  recordId: number,
  score: number,
): Promise<boolean> {
  try {
    validateRecordId(recordId);
    validateScore(score);

    console.log(
      `[TextQuality] Updating record ${recordId} with score ${score}`,
    );

    const db = await getDatabase();
    const updateQuery = `
      UPDATE text_quality_control
      SET score = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const affectedRows = await executeUpdate(db, updateQuery, [
      score,
      recordId,
    ]);

    if (affectedRows > 0) {
      console.log(
        `[TextQuality] Score updated successfully for record ${recordId}`,
      );
      return true;
    } else {
      console.error(
        `[TextQuality] Failed to update score - record ${recordId} not found`,
      );
      return false;
    }
  } catch (error) {
    console.error("[TextQuality] Error updating quality score:", error);
    return false;
  }
}

/**
 * Parses AI response to extract quality score
 * @param response AI service response
 * @returns Parsed quality score
 */
function parseQualityScore(response: string): number {
  const score = parseInt(response.trim(), 10);

  if (
    isNaN(score) ||
    score < QUALITY_CONSTANTS.MIN_SCORE ||
    score > QUALITY_CONSTANTS.MAX_SCORE
  ) {
    throw new Error(`Invalid score received from AI: ${response}`);
  }

  return score;
}

export interface ParsedQualityEvaluation {
  score: number;
  qualityReport?: QualityReportArtifact;
}

export interface QualityEvaluationOutcome {
  score: number;
  qualityReport?: QualityReportArtifact;
}

function stripCodeFence(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length <= 2) {
    return trimmed;
  }

  const withoutStart = lines[0]?.startsWith("```") ? lines.slice(1) : lines;
  const withoutEnd = withoutStart.at(-1)?.startsWith("```")
    ? withoutStart.slice(0, -1)
    : withoutStart;
  return withoutEnd.join("\n").trim();
}

export function parseQualityEvaluationResponse(
  response: string,
): ParsedQualityEvaluation {
  const cleanedResponse = stripCodeFence(response);

  try {
    const parsed = JSON.parse(cleanedResponse) as unknown;
    if (validateQualityReportArtifact(parsed)) {
      const roundedScore = Math.round(parsed.overall);
      validateScore(roundedScore);
      return {
        score: roundedScore,
        qualityReport: parsed,
      };
    }
  } catch {
    // Ignore JSON parsing errors and fall back to numeric parsing.
  }

  return {
    score: parseQualityScore(cleanedResponse),
  };
}

export async function updateProcessedText(
  recordId: number,
  processedText: string,
): Promise<boolean> {
  try {
    validateRecordId(recordId);
    if (!processedText || typeof processedText !== "string") {
      throw new Error("Processed text must be a non-empty string");
    }

    const db = await getDatabase();
    const updateQuery = `
      UPDATE text_quality_control
      SET processed_text = $1, updated_at = NOW()
      WHERE id = $2
    `;
    const affectedRows = await executeUpdate(db, updateQuery, [
      processedText,
      recordId,
    ]);

    return affectedRows > 0;
  } catch (error) {
    logger.warn("process.quality.update_processed_text_failed", {
      processStatus: "running",
      meta: {
        recordId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return false;
  }
}

export async function updateProcessingOptions(
  recordId: number,
  processingOptions: Record<string, unknown>,
): Promise<boolean> {
  try {
    validateRecordId(recordId);
    const processingOptionsJson = JSON.stringify(processingOptions || {});
    const db = await getDatabase();
    const updateQuery = `
      UPDATE text_quality_control
      SET processing_options = $1, updated_at = NOW()
      WHERE id = $2
    `;
    const affectedRows = await executeUpdate(db, updateQuery, [
      processingOptionsJson,
      recordId,
    ]);

    return affectedRows > 0;
  } catch (error) {
    logger.warn("process.quality.update_processing_options_failed", {
      processStatus: "running",
      meta: {
        recordId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return false;
  }
}

/**
 * Prepares evaluation prompt with actual content
 * @param originalText Original text content
 * @param processedText Processed text content
 * @param promptUsed Prompt used for processing
 * @returns Prepared evaluation prompt
 */
/**
 * Evaluates the quality of processed text using AI
 * @param recordId The ID of the record to evaluate
 * @param originalText The original text
 * @param processedText The processed text
 * @param promptUsed The prompt used for processing
 * @returns Promise resolving to the quality score
 */
export async function evaluateTextQualityDetailed(
  recordId: number,
  originalText: string,
  processedText: string,
  promptUsed: string,
  rewritePlanDraft?: string,
  trace?: ProcessTrace,
  senderIntent?: string,
  context?: QualityEvaluationContext,
): Promise<QualityEvaluationOutcome> {
  const startTime = Date.now();

  try {
    validateRecordId(recordId);
    validateTextInput(originalText, processedText);

    if (!promptUsed || typeof promptUsed !== "string") {
      throw new Error("Prompt used must be a non-empty string");
    }

    logger.info("process.quality.started", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "running",
      meta: { recordId },
    });

    const promptTemplate = await configService.getPrompt("qualityEvaluation");
    const senderIntentPrompt =
      typeof senderIntent === "string" && senderIntent.trim().length > 0
        ? senderIntent
        : await configService.getPrompt("senderIntent");
    const evaluationPrompt = prepareEvaluationPrompt(
      originalText,
      processedText,
      promptUsed,
      rewritePlanDraft,
      promptTemplate,
      senderIntentPrompt,
      context,
    );

    const aiStartTime = Date.now();
    const response = await getQualityScore(evaluationPrompt, trace);
    const aiProcessingTime = Date.now() - aiStartTime;

    const parsedEvaluation = parseQualityEvaluationResponse(response);
    const score = parsedEvaluation.score;
    const updated = await updateQualityScore(recordId, score);

    if (parsedEvaluation.qualityReport) {
      logger.debug("process.quality.report.generated", {
        requestId: trace?.requestId,
        processId: trace?.processId,
        processStatus: "completed",
        meta: {
          recordId,
          overall: parsedEvaluation.qualityReport.overall,
          failures: parsedEvaluation.qualityReport.failures.length,
        },
      });
    }

    if (!updated) {
      logger.warn("process.quality.update_score_failed", {
        requestId: trace?.requestId,
        processId: trace?.processId,
        processStatus: "running",
        meta: { recordId },
      });
    }

    const totalProcessingTime = Date.now() - startTime;
    logger.info("process.quality.completed", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "completed",
      meta: { recordId, qualityScore: score, totalProcessingTime, aiProcessingTime },
    });

    return {
      score,
      qualityReport: parsedEvaluation.qualityReport,
    };
  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;
    logger.error("process.failed", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "failed",
      meta: {
        recordId,
        totalProcessingTime,
        reason: "quality_evaluation_failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function evaluateTextQuality(
  recordId: number,
  originalText: string,
  processedText: string,
  promptUsed: string,
  rewritePlanDraft?: string,
  trace?: ProcessTrace,
  senderIntent?: string,
  context?: QualityEvaluationContext,
): Promise<number> {
  const outcome = await evaluateTextQualityDetailed(
    recordId,
    originalText,
    processedText,
    promptUsed,
    rewritePlanDraft,
    trace,
    senderIntent,
    context,
  );

  return outcome.score;
}

/**
 * Safely purges only completed or failed records that are old enough
 * This ensures concurrent users are never interrupted
 * @param hoursToKeep Number of hours to keep completed records (default: 6)
 * @returns Number of records deleted
 */
export async function purgeOldRecords(
  hoursToKeep: number = QUALITY_CONSTANTS.SAFE_PURGE_HOURS,
): Promise<number> {
  try {
    if (hoursToKeep <= 0) {
      throw new Error("Hours to keep must be positive");
    }

    const db = await getDatabase();

    // CONCURRENT-SAFE: Only delete records that are:
    // 1. In 'completed' or 'failed' status (never 'pending' or 'processing')
    // 2. Older than the safe threshold
    // Use parameterized query to prevent SQL injection
    const deleteQuery = `
      DELETE FROM text_quality_control
      WHERE status IN ($1, $2)
      AND created_at < NOW() - ($3 * INTERVAL '1 hour')
    `;

    const deletedCount = await executeDelete(db, deleteQuery, [
      QUALITY_CONSTANTS.STATUS_COMPLETED,
      QUALITY_CONSTANTS.STATUS_FAILED,
      hoursToKeep,
    ]);

    if (deletedCount > 0) {
      console.log(
        `[TextQuality] Safely purged ${deletedCount} old completed/failed records (concurrent-safe)`,
      );
    }

    return deletedCount;
  } catch (error) {
    console.error("[TextQuality] Error purging old records:", error);
    return 0;
  }
}

/**
 * Updates a record status to mark it as being processed
 * @param recordId The ID of the record to update
 * @returns Promise resolving to true if successful
 */
export async function markRecordAsProcessing(
  recordId: number,
): Promise<boolean> {
  try {
    const db = await getDatabase();
    const updateQuery = `
      UPDATE text_quality_control 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND status = $3
    `;

    const updatedCount = await executeUpdate(db, updateQuery, [
      QUALITY_CONSTANTS.STATUS_PROCESSING,
      recordId,
      QUALITY_CONSTANTS.DEFAULT_STATUS, // Only update if still 'pending'
    ]);

    return updatedCount > 0;
  } catch (error) {
    console.error(
      `[TextQuality] Error marking record ${recordId} as processing:`,
      error,
    );
    return false;
  }
}

/**
 * Updates a record status to mark it as completed
 * @param recordId The ID of the record to update
 * @param score The quality score (optional)
 * @returns Promise resolving to true if successful
 */
export async function markRecordAsCompleted(
  recordId: number,
  score?: number,
): Promise<boolean> {
  try {
    const db = await getDatabase();
    const updateQuery = `
      UPDATE text_quality_control 
      SET status = $1, score = $2, updated_at = NOW()
      WHERE id = $3
    `;

    const updatedCount = await executeUpdate(db, updateQuery, [
      QUALITY_CONSTANTS.STATUS_COMPLETED,
      score || null,
      recordId,
    ]);

    return updatedCount > 0;
  } catch (error) {
    console.error(
      `[TextQuality] Error marking record ${recordId} as completed:`,
      error,
    );
    return false;
  }
}

/**
 * Updates a record status to mark it as failed
 * @param recordId The ID of the record to update
 * @returns Promise resolving to true if successful
 */
export async function markRecordAsFailed(recordId: number): Promise<boolean> {
  try {
    const db = await getDatabase();
    const updateQuery = `
      UPDATE text_quality_control 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;

    const updatedCount = await executeUpdate(db, updateQuery, [
      QUALITY_CONSTANTS.STATUS_FAILED,
      recordId,
    ]);

    return updatedCount > 0;
  } catch (error) {
    console.error(
      `[TextQuality] Error marking record ${recordId} as failed:`,
      error,
    );
    return false;
  }
}

/**
 * Sets up scheduled purge job (concurrent-safe)
 */
function schedulePeriodicPurge(): void {
  const purgeIntervalMs = QUALITY_CONSTANTS.PURGE_INTERVAL_MINUTES * 60 * 1000;

  console.log(
    `[TextQuality] Scheduling concurrent-safe automatic purge every ${QUALITY_CONSTANTS.PURGE_INTERVAL_MINUTES} minutes`,
  );

  setInterval(() => {
    console.log(
      `[TextQuality] Running scheduled concurrent-safe purge (only completed/failed records older than ${QUALITY_CONSTANTS.SAFE_PURGE_HOURS} hours)`,
    );
    purgeOldRecords().catch((error) => {
      console.error("[TextQuality] Error running scheduled purge:", error);
    });
  }, purgeIntervalMs);
}

/**
 * Safely deletes a specific completed record immediately after quality evaluation
 * Only deletes if the record is in 'completed' status to prevent race conditions
 * @param recordId The ID of the record to delete
 * @returns Promise resolving to true if successful
 */
export async function deleteRecord(recordId: number): Promise<boolean> {
  try {
    if (recordId <= 0) {
      throw new Error("Valid record ID is required");
    }

    const db = await getDatabase();

    // CONCURRENT-SAFE: Only delete if record is marked as completed
    // This prevents race conditions with other concurrent users
    const deleteQuery = `
      DELETE FROM text_quality_control 
      WHERE id = $1 AND status = $2
    `;

    const deletedCount = await executeDelete(db, deleteQuery, [
      recordId,
      QUALITY_CONSTANTS.STATUS_COMPLETED,
    ]);

    if (deletedCount > 0) {
      console.log(
        `[TextQuality] Safely deleted completed record ${recordId} (concurrent-safe)`,
      );
      return true;
    } else {
      console.log(
        `[TextQuality] Record ${recordId} not deleted (may be in use by another process)`,
      );
      return false;
    }
  } catch (error) {
    console.error(`[TextQuality] Error deleting record ${recordId}:`, error);
    return false;
  }
}

/**
 * Initializes the concurrent-safe text quality control service
 */
export function initializeTextQualityControl(): void {
  console.log(
    "[TextQuality] Initializing concurrent-safe text quality control service",
  );
  console.log(
    `[TextQuality] Completed records will be safely deleted after ${QUALITY_CONSTANTS.SAFE_PURGE_HOURS} hours`,
  );
  console.log(
    "[TextQuality] Active processing records are protected from deletion",
  );

  // Run initial safe purge (only completed/failed records)
  purgeOldRecords().catch((error) => {
    console.error("[TextQuality] Error running initial safe purge:", error);
  });

  // Schedule periodic concurrent-safe purge
  schedulePeriodicPurge();

  console.log(
    "[TextQuality] Concurrent-safe text quality control service initialized - multiple users supported",
  );
}

/**
 * Gets a text quality record by ID
 * @param recordId The ID of the record to retrieve
 * @returns Promise resolving to the record if found, null otherwise
 */
export async function getTextQualityRecord(
  recordId: number,
): Promise<TextQualityRecord | null> {
  try {
    validateRecordId(recordId);

    console.log(`[TextQuality] Getting record with ID: ${recordId}`);

    const db = await getDatabase();
    const selectQuery = `
      SELECT * FROM text_quality_control
      WHERE id = $1
    `;

    const result = await executeQuerySingle(db, selectQuery, [recordId]);

    if (result) {
      console.log(`[TextQuality] Record found with ID: ${recordId}`);
      return result as TextQualityRecord;
    } else {
      console.error(`[TextQuality] Record not found with ID: ${recordId}`);
      return null;
    }
  } catch (error) {
    console.error("[TextQuality] Error getting text quality record:", error);
    return null;
  }
}
