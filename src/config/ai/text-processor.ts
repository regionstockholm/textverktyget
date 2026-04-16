/**
 * Text Processor Module
 * Provides functionality for processing and combining text chunks through AI services
 * @module config/ai/text-processor
 */

import { assert } from "../../utils/safety-utils.js";
import { logger } from "../../utils/logger.js";
import { getSummary } from "./ai-service-factory.js";
import type { ProcessingOptions } from "./ai-service-types.js";
import { config } from "../app-config.js";
import { preserveLineSeparatorTrim } from "./text-normalization.js";

/**
 * Maximum number of chunks to process
 * @constant {number}
 */
export const MAX_CHUNKS: number = config.performance.maxChunks;

function resolveMaxChunks(options: ProcessingOptions): number {
  const candidate = options.maxChunks;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    return MAX_CHUNKS;
  }

  const parsed = Math.trunc(candidate);
  if (parsed < 1 || parsed > 100) {
    return MAX_CHUNKS;
  }

  return parsed;
}

/**
 * Interface for summarization result
 * @interface SummarizationResult
 */
export interface SummarizationResult {
  summary: string;
  originalLength: number;
  summaryLength: number;
  processingTime: number;
  systemMessage?: string;
  qualityEvaluationId?: number;
  qualityScore?: number;
  qualityAttempts?: number;
  needsResubmission?: boolean;
  maxQualityAttempts?: number;
}

/**
 * Processes chunks sequentially
 *
 * @param {string[]} chunks - Array of chunks
 * @param {ProcessingOptions} options - Summarization options
 * @returns {Promise<SummarizationResult[]>} Array of results
 */
export async function processChunksSequentially(
  chunks: string[],
  options: ProcessingOptions,
): Promise<SummarizationResult[]> {
  // Assert preconditions
  assert(Array.isArray(chunks), "Chunks must be an array");
  assert(chunks.length > 0, "No chunks to process");
  assert(typeof options === "object", "Options must be an object");

  // Declare variables in smallest scope
  const results: SummarizationResult[] = [];

  // Bounded loop
  const effectiveMaxChunks = resolveMaxChunks(options);
  const iterationLimit = Math.min(chunks.length, effectiveMaxChunks);
  const requestId = options.requestId;
  const processId = options.processId || options.requestId;

  logger.debug("process.chunks.start", {
    requestId,
    processId,
    processStatus: "running",
    meta: { iterationLimit, totalChunks: chunks.length },
  });

  // Simple control flow
  for (let i = 0; i < iterationLimit; i++) {
    const chunk = chunks[i];

    // Skip empty chunks
    if (!chunk || !preserveLineSeparatorTrim(chunk)) continue;

    // Process chunk
    const startTime = Date.now();
    logger.info("process.ai.requested", {
      requestId,
      processId,
      processStatus: "running",
      meta: { chunkIndex: i + 1, totalChunks: chunks.length },
    });
    const response = await getSummary(chunk, options);
    const endTime = Date.now();
    logger.info("process.ai.responded", {
      requestId,
      processId,
      processStatus: "running",
      meta: {
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        latencyMs: endTime - startTime,
        status: "success",
      },
    });

    // Add result
    results.push({
      summary: preserveLineSeparatorTrim(response.summary),
      originalLength: chunk.length,
      summaryLength: response.summary.length,
      processingTime: endTime - startTime,
      systemMessage:
        i === 0
          ? response.systemMessage
            ? preserveLineSeparatorTrim(response.systemMessage)
            : undefined
          : undefined, // Only store systemMessage from first chunk
    });
  }
  logger.debug("process.chunks.done", {
    requestId,
    processId,
    processStatus: "running",
    meta: { resultCount: results.length },
  });

  return results;
}

/**
 * Combines results from multiple chunks
 *
 * @param {SummarizationResult[]} results - Array of results
 * @returns {Object} Combined result
 */
export function combineResults(results: SummarizationResult[]): any {
  // Assert preconditions
  assert(Array.isArray(results), "Results must be an array");
  assert(results.length > 0, "No results to combine");

  // Declare variables in smallest scope
  const combinedSummary = results
    .map((result) => preserveLineSeparatorTrim(result.summary))
    .join("\n\n");
  const totalOriginalLength = results.reduce(
    (total, result) => total + result.originalLength,
    0,
  );
  const totalSummaryLength = combinedSummary.length;
  const totalProcessingTime = results.reduce(
    (total, result) => total + result.processingTime,
    0,
  );

  // Get the system message from the first result (if available)
  const systemMessage = results[0]?.systemMessage
    ? preserveLineSeparatorTrim(results[0].systemMessage)
    : "";

  const result = {
    summary: combinedSummary,
    originalLength: totalOriginalLength,
    summaryLength: totalSummaryLength,
    processingTime: totalProcessingTime,
    compressionRatio: Math.round(
      (totalSummaryLength / totalOriginalLength) * 100,
    ),
    systemMessage: systemMessage,
  };

  return result;
}
