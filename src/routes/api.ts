/**
 * Consolidated API Routes
 * All API endpoints in one focused file
 */

import express, { Request, Response } from "express";
import * as cheerio from "cheerio";
import { rateLimiters } from "../utils/api/rate-limits.js";
import { sendError, sendSuccess } from "../utils/api/api-responses.js";
import { validateSummarizeRequest } from "../config/ai/ai-validation.js";
import { validateQualityEvaluationRequest } from "../validators/quality-validator.js";
import { handleSummarization } from "../config/ai/summarize-handler.js";
import configService from "../services/config/config-service.js";
import {
  getTextQualityRecord,
  evaluateTextQuality,
  markRecordAsProcessing,
} from "../services/quality-evaluation-controls.js";
import { config } from "../config/app-config.js";
import { logger } from "../utils/logger.js";
import {
  getTaskDefinitionByKey,
  listTaskDefinitions,
} from "../services/tasks/task-catalog-service.js";
import { getPrismaClient } from "../config/database/prisma-client.js";
import {
  enqueueSummarize,
  getSummarizeQueueState,
  SummarizeQueueOverloadedError,
  SummarizeQueueTimeoutError,
} from "../services/summarize/summarize-queue.js";
import { recordSummarizeRequestMetric } from "../services/summarize/auto-profile-controller.js";
import {
  getSummarizeProgress,
  subscribeSummarizeProgress,
  setSummarizeProgress,
} from "../services/summarize/progress-tracker.js";
import {
  fetchPublicWebContent,
  UrlFetchGuardError,
  UrlFetchHttpError,
} from "../utils/security/url-fetch-guard.js";
import { getTargetAudienceCatalog } from "../services/target-audiences/target-audience-catalog-service.js";

const router = express.Router();
const DEFAULT_MAX_QUALITY_ATTEMPTS = 5;
const prisma = getPrismaClient();

router.get(
  "/target-audiences",
  rateLimiters.standard,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const catalog = await getTargetAudienceCatalog(prisma);
      const categories = catalog.categories
        .map((category) => ({
          name: category.name,
          sortOrder: category.sortOrder,
          audiences: catalog.audiences
            .filter((audience) => audience.category === category.name)
            .sort(
              (a, b) =>
                a.sortOrder - b.sortOrder ||
                a.label.localeCompare(b.label, "sv"),
            )
            .map((audience) => ({
              label: audience.label,
              sortOrder: audience.sortOrder,
            })),
        }))
        .filter((category) => category.audiences.length > 0)
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv"),
        );

      sendSuccess(res, { categories });
    } catch (error) {
      sendError(res, 500, "Failed to load target audiences");
    }
  },
);

function normalizeClientProcessId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 120) {
    return null;
  }

  if (!/^[A-Za-z0-9:_-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function writeSseEvent(
  res: Response,
  eventName: string,
  payload: unknown,
): void {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function isTransientSummarizeError(error: unknown): boolean {
  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    message = String((error as { message?: string }).message);
  }

  if (!message) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  const transientIndicators = [
    "rate limit",
    "resource exhausted",
    "quota",
    "timeout",
    "timed out",
    "unavailable",
    "overloaded",
    "network",
    "connection",
    "429",
    "502",
    "503",
    "504",
    "tillfälligt upptagen",
    "ett fel uppstod vid bearbetning",
    "försök igen senare",
  ];

  return transientIndicators.some((indicator) =>
    normalizedMessage.includes(indicator),
  );
}

router.get(
  "/tasks",
  rateLimiters.standard,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const tasks = await listTaskDefinitions({ enabledOnly: true });
      res.set("Cache-Control", "no-store");
      sendSuccess(
        res,
        tasks.map((task) => ({
          key: task.key,
          label: task.label,
          description: task.description,
          sortOrder: task.sortOrder,
          promptName: `task:${task.key}`,
          settings: {
            outputMode: task.outputMode,
            bulletCount: task.bulletCount,
            maxChars: task.maxChars,
            targetAudienceEnabled: task.targetAudienceEnabled,
            rewritePlanEnabled: task.rewritePlanEnabled,
          },
        })),
      );
    } catch (error) {
      sendError(res, 500, "Failed to load tasks");
    }
  },
);

router.get(
  "/quality-config",
  rateLimiters.standard,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const retryCount = await configService.getRetryCount();
      const maxQualityAttempts =
        Number.isInteger(retryCount) && retryCount > 0
          ? retryCount
          : DEFAULT_MAX_QUALITY_ATTEMPTS;
      sendSuccess(res, { maxQualityAttempts });
    } catch (error) {
      sendError(res, 500, "Failed to load quality config");
    }
  },
);

router.get(
  "/summarize-progress/:processId",
  rateLimiters.progress,
  async (req: Request, res: Response): Promise<void> => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const processId = Array.isArray(req.params.processId)
      ? req.params.processId[0]
      : req.params.processId;

    const normalizedProcessId = normalizeClientProcessId(processId);
    if (!normalizedProcessId) {
      sendError(res, 400, "Invalid process id");
      return;
    }

    const snapshot = getSummarizeProgress(normalizedProcessId);
    if (!snapshot) {
      sendError(res, 404, "Process not found");
      return;
    }

    sendSuccess(res, snapshot);
  },
);

router.get(
  "/summarize-progress/stream/:processId",
  rateLimiters.progress,
  async (req: Request, res: Response): Promise<void> => {
    const processId = Array.isArray(req.params.processId)
      ? req.params.processId[0]
      : req.params.processId;
    const normalizedProcessId = normalizeClientProcessId(processId);

    if (!normalizedProcessId) {
      sendError(res, 400, "Invalid process id");
      return;
    }

    res.status(200);
    res.set("Content-Type", "text/event-stream");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Connection", "keep-alive");
    res.set("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const sendSnapshot = (): void => {
      const snapshot = getSummarizeProgress(normalizedProcessId);
      if (snapshot) {
        writeSseEvent(res, "stage", snapshot);
      }
    };

    const unsubscribe = subscribeSummarizeProgress(
      normalizedProcessId,
      (snapshot) => {
        writeSseEvent(res, "stage", snapshot);
        if (snapshot.isTerminal) {
          unsubscribe();
          clearInterval(heartbeatId);
          res.end();
        }
      },
    );

    const heartbeatId = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);

    sendSnapshot();

    req.on("close", () => {
      unsubscribe();
      clearInterval(heartbeatId);
      if (!res.writableEnded) {
        res.end();
      }
    });
  },
);

// =============================================================================
// TEXT SUMMARIZATION ROUTES
// =============================================================================

/**
 * POST /api/summarize
 * Process and summarize text content
 */
router.post(
  "/summarize",
  rateLimiters.summarize,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const processId =
      normalizeClientProcessId(req.body?.processId) || requestId;

    const recordMetric = (
      statusCode: number,
      transientFailure = false,
    ): void => {
      recordSummarizeRequestMetric({
        statusCode,
        latencyMs: Date.now() - startTime,
        transientFailure,
      });
    };

    try {
      logger.info("process.started", {
        requestId,
        processId,
        processStatus: "running",
        meta: { route: "/api/summarize" },
      });

      // Set up abort signal listener to log when client cancels
      req.socket.on("close", () => {
        if (!res.headersSent) {
          logger.warn("process.client.disconnected", {
            requestId,
            processId,
            processStatus: "cancelled",
          });
          setSummarizeProgress(processId, "cancelled");
        }
      });

      const validation = validateSummarizeRequest(req.body);
      if (!validation.valid) {
        setSummarizeProgress(processId, "failed");
        sendError(res, 400, "Invalid request", validation.message);
        return;
      }

      const { text, taskKey, targetAudience, checkboxContent = [] } = req.body;

      // Prevent gigabyte-sized texts from overwhelming the system
      if (text && text.length > config.performance.maxTextLength) {
        const maxMB = (
          config.performance.maxTextLength /
          (1024 * 1024)
        ).toFixed(1);
        const actualMB = (text.length / (1024 * 1024)).toFixed(1);
        console.warn(
          `[API] Text too large: ${actualMB}MB (max: ${maxMB}MB) (${requestId})`,
        );
        logger.warn("process.failed", {
          requestId,
          processId,
          processStatus: "failed",
          meta: { reason: "text_too_large", actualMB, maxMB },
        });
        setSummarizeProgress(processId, "failed");
        sendError(
          res,
          413,
          "Text too large",
          `Text size (${actualMB}MB) exceeds maximum allowed size (${maxMB}MB)`,
        );
        return;
      }

      // Handle summarization
      try {
        const normalizedTaskKey =
          typeof taskKey === "string" ? taskKey.trim() : "";
        const taskDefinition = await getTaskDefinitionByKey(normalizedTaskKey);
        if (!taskDefinition) {
          setSummarizeProgress(processId, "failed");
          sendError(res, 400, "Invalid request", "Ogiltig uppgift.");
          return;
        }

        if (!taskDefinition.enabled) {
          setSummarizeProgress(processId, "failed");
          sendError(res, 400, "Invalid request", "Vald uppgift är inte aktiv.");
          return;
        }

        const activeTaskPrompt = await prisma.promptTemplate.findFirst({
          where: {
            name: `task:${taskDefinition.key}`,
            isActive: true,
          },
          orderBy: { version: "desc" },
        });

        if (!activeTaskPrompt) {
          recordMetric(500, false);
          setSummarizeProgress(processId, "failed");
          sendError(
            res,
            500,
            "Task prompt missing",
            "Den valda uppgiftsprompten saknas.",
          );
          return;
        }

        const defaultTargetAudience = configService.getDefaultTargetAudienceLabel();
        let resolvedTargetAudience =
          typeof targetAudience === "string" && targetAudience.trim().length > 0
            ? targetAudience
            : defaultTargetAudience;

        if (!taskDefinition.targetAudienceEnabled) {
          resolvedTargetAudience = defaultTargetAudience;
        }

        console.log(`[API] Starting AI processing (${requestId})`);
        logger.info("process.ai.requested", {
          requestId,
          processId,
          processStatus: "running",
          meta: { provider: process.env.AI_PROVIDER || "default" },
        });

        // Create a callback to check if client is still connected
        const isClientConnected = () => {
          const connected = !res.socket?.destroyed && !res.writableEnded;
          if (!connected) {
            console.log(
              `[API] Client connection check: DISCONNECTED (${requestId})`,
            );
            logger.warn("process.client.disconnected", {
              requestId,
              processId,
              processStatus: "cancelled",
            });
          }
          return connected;
        };

        const queueStateBeforeEnqueue = getSummarizeQueueState();
        const likelyQueuedDueToDemand =
          queueStateBeforeEnqueue.queuedJobs > 0 ||
          queueStateBeforeEnqueue.runningJobs >=
            queueStateBeforeEnqueue.maxConcurrentJobs;

        if (likelyQueuedDueToDemand) {
          setSummarizeProgress(
            processId,
            "queued",
            "Hog belastning just nu, ditt uppdrag ligger i ko...",
          );
        } else {
          setSummarizeProgress(processId, "analysis");
        }

        logger.debug("process.queue.enqueue", {
          requestId,
          processId,
          processStatus: "running",
          meta: {
            ...queueStateBeforeEnqueue,
            likelyQueuedDueToDemand,
          },
        });

        const result = await enqueueSummarize(() =>
          handleSummarization(
            text,
            {
              taskKey: taskDefinition.key,
              targetAudience: resolvedTargetAudience,
              checkboxContent: Array.isArray(checkboxContent)
                ? checkboxContent.join(", ")
                : String(checkboxContent),
              requestId,
              processId,
              rewritePlanEnabled: taskDefinition.rewritePlanEnabled,
              taskOutputMode: taskDefinition.outputMode,
            },
            isClientConnected,
          ),
        );

        const processingTime = Date.now() - startTime;
        console.log(
          `[API] AI processing completed in ${processingTime}ms (${requestId})`,
        );
        logger.info("process.ai.responded", {
          requestId,
          processId,
          processStatus: "running",
          meta: { status: "success", latencyMs: processingTime },
        });

        // Check if client has disconnected before sending response
        if (!res.headersSent && res.socket && res.socket.destroyed) {
          console.log(
            `[API] Client disconnected, not sending response (${requestId})`,
          );
          logger.warn("process.client.disconnected", {
            requestId,
            processId,
            processStatus: "cancelled",
          });
          setSummarizeProgress(processId, "cancelled");
          return;
        }

        // Validate that we got a valid summary
        if (
          !result ||
          !result.summary ||
          typeof result.summary !== "string" ||
          result.summary.trim().length === 0
        ) {
          console.error(
            `[API] Invalid or empty summary received from AI (${requestId})`,
          );
          console.error(
            `[API] Result type: ${typeof result}, has summary: ${!!result?.summary}`,
          );
          logger.error("process.failed", {
            requestId,
            processId,
            processStatus: "failed",
            meta: { reason: "empty_summary" },
          });
          setSummarizeProgress(processId, "failed");
          sendError(
            res,
            500,
            "AI returned empty response",
            "The AI service did not return a valid text summary. Please try again.",
          );
          recordMetric(500, false);
          return;
        }

        // Extract quality evaluation data from result if available
        interface SummarizationResponse {
          summary: string;
          originalLength: number;
          summaryLength: number;
          processingTime: number;
          compressionRatio: number;
          processId: string;
          systemMessage?: string;
          qualityEvaluationId?: number;
          qualityAttempts?: number;
          qualityScore?: number;
          needsResubmission?: boolean;
          maxQualityAttempts?: number;
        }

        const summaryText = result.summary;

        const responseData: SummarizationResponse = {
          summary: summaryText,
          originalLength: text.length,
          summaryLength: summaryText.length,
          processingTime,
          compressionRatio: Math.round(text.length / summaryText.length),
          processId,
          systemMessage: result.systemMessage || undefined,
        };

        // Add quality evaluation data if available
        const resultMaxAttempts = (result as { maxQualityAttempts?: number })
          .maxQualityAttempts;

        if (result.qualityEvaluationId) {
          responseData.qualityEvaluationId = result.qualityEvaluationId;
          responseData.qualityAttempts = result.qualityAttempts || 1;
          responseData.maxQualityAttempts =
            resultMaxAttempts ?? config.qualityControl.maxAttempts;

          if (result.qualityScore !== undefined) {
            responseData.qualityScore = result.qualityScore;
            responseData.needsResubmission = result.needsResubmission || false;
          }
        }

        console.log(`[API] Sending response to client (${requestId})`);
        logger.info("process.completed", {
          requestId,
          processId,
          processStatus: "completed",
          meta: {
            processingTime,
            qualityScore: responseData.qualityScore,
            qualityEvaluationId: responseData.qualityEvaluationId,
          },
        });
        setSummarizeProgress(processId, "completed");
        sendSuccess(res, responseData);
        recordMetric(200, false);
        return;
      } catch (error) {
        console.error(`[API] Summarization error (${requestId}):`, error);

        if (
          error instanceof SummarizeQueueOverloadedError ||
          error instanceof SummarizeQueueTimeoutError
        ) {
          const queueState = getSummarizeQueueState();
          const retryAfter = queueState.retryAfterSeconds;
          res.setHeader("Retry-After", String(retryAfter));
          logger.warn("process.queue.rejected", {
            requestId,
            processId,
            processStatus: "failed",
            meta: {
              reason:
                error instanceof SummarizeQueueOverloadedError
                  ? "queue_full"
                  : "queue_timeout",
              retryAfter,
              ...queueState,
            },
          });
          setSummarizeProgress(processId, "failed");
          sendError(
            res,
            503,
            "Service busy",
            "Tjänsten är tillfälligt överbelastad. Försök igen om en liten stund.",
          );
          recordMetric(503, false);
          return;
        }

        if (isTransientSummarizeError(error)) {
          const queueState = getSummarizeQueueState();
          const retryAfter = queueState.retryAfterSeconds;
          res.setHeader("Retry-After", String(retryAfter));
          logger.warn("process.provider.transient_failure", {
            requestId,
            processId,
            processStatus: "failed",
            meta: {
              retryAfter,
              error: error instanceof Error ? error.message : "unknown",
            },
          });
          setSummarizeProgress(processId, "failed");
          sendError(
            res,
            503,
            "Service busy",
            "Tjänsten är tillfälligt överbelastad. Försök igen om en liten stund.",
          );
          recordMetric(503, true);
          return;
        }

        logger.error("process.failed", {
          requestId,
          processId,
          processStatus: "failed",
          meta: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
        setSummarizeProgress(processId, "failed");

        // Check if client has disconnected
        if (!res.headersSent && res.socket && res.socket.destroyed) {
          console.log(
            `[API] Client disconnected, not sending error response (${requestId})`,
          );
          logger.warn("process.client.disconnected", {
            requestId,
            processId,
            processStatus: "cancelled",
          });
          setSummarizeProgress(processId, "cancelled");
          return;
        }

        sendError(res, 500, "Summarization failed", undefined);
        recordMetric(500, false);
        return;
      }
    } catch (error) {
      console.error(`[API] Summarize error (${requestId}):`, error);
      logger.error("process.failed", {
        requestId,
        processId,
        processStatus: "failed",
        meta: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      setSummarizeProgress(processId, "failed");

      // Check if client has disconnected
      if (!res.headersSent && res.socket && res.socket.destroyed) {
        console.log(
          `[API] Client disconnected, not sending error response (${requestId})`,
        );
        logger.warn("process.client.disconnected", {
          requestId,
          processId,
          processStatus: "cancelled",
        });
        setSummarizeProgress(processId, "cancelled");
        return;
      }

      sendError(res, 500, "Internal server error", undefined);
      recordMetric(500, false);
    }
  },
);

// =============================================================================
// QUALITY EVALUATION ROUTES
// =============================================================================

/**
 * POST /api/quality/evaluate
 * Evaluate the quality of processed text
 */
router.post(
  "/quality/evaluate",
  rateLimiters.quality,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const requestId = `QUAL-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const processId = requestId;

    try {
      console.log(`[API] Quality evaluation request received (${requestId})`);
      logger.info("process.quality.started", {
        requestId,
        processId,
        processStatus: "running",
      });

      // Set up abort signal listener to log when client cancels
      req.socket.on("close", () => {
        if (!res.headersSent) {
          console.log(
            `[API] Client disconnected, quality evaluation cancelled (${requestId})`,
          );
          logger.warn("process.client.disconnected", {
            requestId,
            processId,
            processStatus: "cancelled",
          });
        }
      });

      const validation = validateQualityEvaluationRequest(req.body);
      const { recordId } = validation;

      // Get the record to access original text, processed text, and prompt
      const record = await getTextQualityRecord(recordId);
      if (!record) {
        sendError(res, 404, "Record not found");
        return;
      }

      // Use atomic locking to prevent race conditions
      // This prevents multiple simultaneous evaluations of the same record
      const locked = await markRecordAsProcessing(recordId);
      if (!locked) {
        // Record is already being processed by another request
        console.warn(`[API] Record ${recordId} is already being processed`);
        logger.warn("process.failed", {
          requestId,
          processId,
          processStatus: "failed",
          meta: { reason: "record_already_processing", recordId },
        });
        sendError(res, 409, "Record is already being processed");
        return;
      }

      console.log(`[API] Starting quality evaluation (${requestId})`);
      const score = await evaluateTextQuality(
        recordId,
        record.original_text,
        record.processed_text,
        record.prompt_used || "",
        record.rewrite_plan_draft || "",
        { requestId, processId },
      );
      const processingTime = Date.now() - startTime;
      console.log(
        `[API] Quality evaluation completed in ${processingTime}ms (${requestId})`,
      );
      logger.info("process.quality.completed", {
        requestId,
        processId,
        processStatus: "completed",
        meta: { recordId, score, processingTime },
      });

      // Check if client has disconnected before sending response
      if (!res.headersSent && res.socket && res.socket.destroyed) {
        console.log(
          `[API] Client disconnected, not sending quality evaluation response (${requestId})`,
        );
        logger.warn("process.client.disconnected", {
          requestId,
          processId,
          processStatus: "cancelled",
        });
        return;
      }

      console.log(
        `[API] Sending quality evaluation response to client (${requestId})`,
      );
      sendSuccess(res, {
        score,
        recordId,
        processingTime,
      });
    } catch (error) {
      console.error(`[API] Quality evaluation error (${requestId}):`, error);
      logger.error("process.failed", {
        requestId,
        processId,
        processStatus: "failed",
        meta: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      // Check if client has disconnected
      if (!res.headersSent && res.socket && res.socket.destroyed) {
        console.log(
          `[API] Client disconnected, not sending error response (${requestId})`,
        );
        logger.warn("process.client.disconnected", {
          requestId,
          processId,
          processStatus: "cancelled",
        });
        return;
      }

      sendError(res, 500, "Quality evaluation failed", undefined);
    }
  },
);

/**
 * GET /api/quality/:id
 * Get quality record by ID
 */
router.get(
  "/quality/:id",
  rateLimiters.quality,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const idParam = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const recordId = parseInt(idParam || "0", 10);

      if (isNaN(recordId)) {
        sendError(res, 400, "Invalid record ID");
        return;
      }

      const record = await getTextQualityRecord(recordId);

      if (!record) {
        sendError(res, 404, "Record not found");
        return;
      }

      sendSuccess(res, record);
    } catch (error) {
      console.error("[API] Get quality record error:", error);
      sendError(res, 500, "Failed to get record", undefined);
    }
  },
);

// =============================================================================
// WEB CONTENT FETCHING ROUTES
// =============================================================================

/**
 * Extract formatted content preserving paragraph and header spacing
 * @param element - Cheerio element to extract content from
 * @param $ - Cheerio instance
 * @returns Formatted text content with proper spacing
 */
function extractFormattedContent(element: any, $: any): string {
  let formattedContent = "";

  // Process direct children to avoid duplicate text from nested elements
  element.children().each((_index: number, child: any) => {
    const $child = $(child);
    const tagName = child.tagName?.toLowerCase();

    switch (tagName) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        formattedContent += `${$child.text().trim()}\n\n`; // Headers get double line break
        break;
      case "p":
        formattedContent += `${$child.text().trim()}\n\n`; // Paragraphs get double line break
        break;
      case "ul":
      case "ol":
        // Process list items within the list
        $child.find("li").each((_liIndex: number, liNode: any) => {
          const liText = $(liNode).text().trim();
          if (liText) {
            formattedContent += `- ${liText}\n\n`; // List items get dash and double line break
          }
        });
        break;
      case "li":
        // Handle standalone list items (not within ul/ol)
        formattedContent += `- ${$child.text().trim()}\n\n`;
        break;
      case "br":
        formattedContent += "\n"; // Break tags become single line breaks
        break;
      case "div":
      case "section":
      case "article":
        // Recursively process nested containers
        formattedContent += extractFormattedContent($child, $);
        break;
      default:
        // For other elements, add text if it's a leaf node
        const text = $child.text().trim();
        if (text && $child.children().length === 0) {
          formattedContent += `${text}\n\n`;
        } else if (text && $child.children().length > 0) {
          // Process nested content recursively
          formattedContent += extractFormattedContent($child, $);
        }
        break;
    }
  });

  // If no formatted content was extracted, fall back to plain text with basic formatting
  if (!formattedContent.trim()) {
    // Extract text and add spacing after sentences and colons
    formattedContent = element
      .text()
      .replace(/\.\s+/g, ".\n\n") // Double line break after sentences
      .replace(/:\s+/g, ":\n") // Single line break after colons
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  return formattedContent.trim();
}

/**
 * POST /api/fetch-web
 * Fetch and extract text content from web URLs
 */
router.post(
  "/fetch-web",
  rateLimiters.standard,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        sendError(res, 400, "Valid URL is required");
        return;
      }

      console.log(
        `[API] Fetching content from: ${url} (timeout: ${config.performance.urlFetchTimeoutMs}ms, maxBytes: ${config.performance.urlFetchMaxResponseBytes})`,
      );

      const fetchedContent = await fetchPublicWebContent(url, {
        timeoutMs: config.performance.urlFetchTimeoutMs,
        maxRedirects: config.performance.urlFetchMaxRedirects,
        maxResponseBytes: config.performance.urlFetchMaxResponseBytes,
        userAgent: "Mozilla/5.0 (compatible; TextverktygsBot/1.0)",
        allowPrivateNetwork: config.performance.urlFetchAllowPrivateNetwork,
      });

      const html = fetchedContent.body;
      const normalizedContentType = fetchedContent.contentType.toLowerCase();
      const isPlainTextResponse = normalizedContentType.includes("text/plain");

      // Parse and extract text content
      const $ = cheerio.load(html);
      console.log(`[API] HTML loaded, document title: ${$("title").text()}`);

      // Remove unwanted elements more comprehensively
      $(
        'script, style, nav, header, footer, aside, .advertisement, .ads, .social-media, .sidebar, .menu, .navigation, .breadcrumb, .cookie-banner, [class*="ad-"], [id*="ad-"], [class*="ads-"], [id*="ads-"]',
      ).remove();

      // Try multiple content extraction strategies
      let content = "";

      // Strategy order prioritizes region-specific extraction first,
      // then generic extraction fallbacks.
      // Strategy 1: Region Stockholm specific extraction with formatting
      if (!isPlainTextResponse && url.includes("regionstockholm.se")) {
        let contentDiv = null;

        // Look for the div that comes after the "Kortversion" section
        const kortVersionSection = $("section.relative.mb-6");
        if (kortVersionSection.length > 0) {
          // Find the next div sibling after the kortversion section
          contentDiv = kortVersionSection.next("div");
          console.log(
            `[API] Found Kortversion section, looking for content after it`,
          );
        } else {
          // No Kortversion section - look for main content div inside .prose
          const proseDiv = $(".prose");
          if (proseDiv.length > 0) {
            // Find the main content div (usually the last div or one containing paragraphs)
            contentDiv = proseDiv.find("div").last();
            if (contentDiv.length === 0) {
              contentDiv = proseDiv; // Use the prose div itself
            }
          }
          console.log(
            `[API] No Kortversion section found, using prose content directly`,
          );
        }

        if (contentDiv && contentDiv.length > 0) {
          // Extract content with proper formatting
          content = extractFormattedContent(contentDiv, $);
          console.log(
            `[API] Found Region Stockholm content using specific extraction (${content.length} chars)`,
          );
        }
      }

      // Strategy 2: Common content containers (for other sites)
      if (!content && !isPlainTextResponse) {
        const contentSelectors = [
          "main",
          "article",
          ".content",
          ".post",
          ".entry",
          ".article-content",
          ".post-content",
          ".entry-content",
          ".main-content",
          ".page-content",
          ".text-content",
          '[role="main"]',
          ".article-body",
          ".story-body",
          ".content-body",
        ];

        for (const selector of contentSelectors) {
          const element = $(selector);
          if (element.length > 0) {
            const extracted = extractFormattedContent(element, $);
            if (extracted && extracted.length > content.length) {
              content = extracted;
              console.log(
                `[API] Found content using selector: ${selector} (${extracted.length} chars)`,
              );
            }
          }
        }
      }

      // Strategy 3: Find the element with most text content (heuristic approach)
      if ((!content || content.length < 100) && !isPlainTextResponse) {
        let maxLength = 0;
        let bestContent = "";

        $("div, section, p").each((_index: number, element: any) => {
          const $elem = $(element);
          const text: string = extractFormattedContent($elem, $);
          if (text.length > maxLength && text.length > 50) {
            maxLength = text.length;
            bestContent = text;
          }
        });

        if (bestContent) {
          content = bestContent;
          console.log(
            `[API] Found content using heuristic approach (${content.length} chars)`,
          );
        }
      }

      // Strategy 4: Fallback to body with better filtering
      if ((!content || content.length < 50) && !isPlainTextResponse) {
        // Remove more elements that are likely not content
        $("button, input, select, textarea, form, .btn, .button").remove();
        const bodyElement = $("body");
        if (bodyElement.length > 0) {
          content = extractFormattedContent(bodyElement, $);
          console.log(`[API] Using body fallback (${content.length} chars)`);
        }
      }

      // Strategy 5: Plain-text response
      if (!content && isPlainTextResponse) {
        content = html.trim();
      }

      // Clean up the text while preserving intentional formatting
      const cleanedContent = content
        .replace(/[ \t]+/g, " ") // Multiple spaces/tabs to single space (preserve newlines)
        .replace(/\n{3,}/g, "\n\n") // Max two consecutive newlines
        .replace(/\n /g, "\n") // Remove spaces after newlines
        .replace(/ \n/g, "\n") // Remove spaces before newlines
        .trim();

      console.log(
        `[API] Final cleaned content length: ${cleanedContent.length} chars`,
      );

      if (!cleanedContent || cleanedContent.length < 10) {
        console.log(
          `[API] No meaningful content found. Raw content sample: ${content.substring(0, 200)}`,
        );
        sendError(res, 422, "No text content could be extracted from the URL");
        return;
      }

      const processingTime = Date.now() - startTime;

      sendSuccess(res, {
        url,
        finalUrl: fetchedContent.finalUrl,
        content: cleanedContent,
        contentLength: cleanedContent.length,
        processingTime,
      });
    } catch (error) {
      console.error("[API] Web fetch error:", error);

      if (error instanceof UrlFetchGuardError) {
        const guardStatusMap: Record<string, number> = {
          INVALID_URL: 400,
          UNSUPPORTED_PROTOCOL: 400,
          UNSUPPORTED_PORT: 400,
          UNSAFE_HOST: 403,
          UNSAFE_IP: 403,
          DNS_LOOKUP_FAILED: 404,
          TOO_MANY_REDIRECTS: 422,
          MISSING_REDIRECT_LOCATION: 422,
          UNSUPPORTED_CONTENT_TYPE: 415,
          CONTENT_TOO_LARGE: 413,
        };

        const statusCode = guardStatusMap[error.code] || 400;
        sendError(res, statusCode, error.message);
        return;
      }

      if (error instanceof UrlFetchHttpError) {
        sendError(res, error.status, `Failed to fetch: ${error.statusText}`);
        return;
      }

      if (error instanceof Error) {
        // Handle AbortController timeout
        if (error.name === "AbortError") {
          sendError(
            res,
            408,
            "Request timeout - the website took too long to respond",
          );
        } else if (error.message.includes("timeout")) {
          sendError(
            res,
            408,
            "Request timeout - the website took too long to respond",
          );
        } else if (error.message.includes("ENOTFOUND")) {
          sendError(res, 404, "Website not found");
        } else {
          sendError(res, 500, "Failed to fetch web content", undefined);
        }
      } else {
        sendError(res, 500, "Unknown error occurred");
      }
    }
  },
);

export default router;
