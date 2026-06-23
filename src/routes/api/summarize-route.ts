import type { Request, Response } from "express";
import { validateSummarizeRequest } from "../../config/ai/ai-validation.js";
import { handleSummarization } from "../../config/ai/summarize-handler.js";
import { config } from "../../config/app-config.js";
import { getPrismaClient } from "../../config/database/prisma-client.js";
import configService from "../../services/config/config-service.js";
import {
  enqueueSummarize,
  getSummarizeQueueState,
  SummarizeQueueOverloadedError,
  SummarizeQueueTimeoutError,
} from "../../services/summarize/summarize-queue.js";
import { setSummarizeProgress } from "../../services/summarize/progress-tracker.js";
import { getTaskDefinitionByKey } from "../../services/tasks/task-catalog-service.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";
import { logger } from "../../utils/logger.js";
import { normalizeClientProcessId } from "./process-id.js";

const prisma = getPrismaClient();

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

function createRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function isClientDisconnected(res: Response): boolean {
  return !res.headersSent && Boolean(res.socket && res.socket.destroyed);
}

function buildSummarizationResponse(
  result: Awaited<ReturnType<typeof handleSummarization>>,
  text: string,
  processingTime: number,
  processId: string,
): SummarizationResponse {
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

  return responseData;
}

export async function handleSummarizeRequest(
  req: Request,
  res: Response,
): Promise<void> {
  const startTime = Date.now();
  const requestId = createRequestId();
  const processId = normalizeClientProcessId(req.body?.processId) || requestId;

  try {
    logger.info("process.started", {
      requestId,
      processId,
      processStatus: "running",
      meta: { route: "/api/summarize" },
    });

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

    if (text && text.length > config.performance.maxTextLength) {
      const maxMB = (config.performance.maxTextLength / (1024 * 1024)).toFixed(1);
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

    try {
      const normalizedTaskKey = typeof taskKey === "string" ? taskKey.trim() : "";
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

      const isClientConnected = () => {
        const connected = !res.socket?.destroyed && !res.writableEnded;
        if (!connected) {
          console.log(`[API] Client connection check: DISCONNECTED (${requestId})`);
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

      if (isClientDisconnected(res)) {
        console.log(`[API] Client disconnected, not sending response (${requestId})`);
        logger.warn("process.client.disconnected", {
          requestId,
          processId,
          processStatus: "cancelled",
        });
        setSummarizeProgress(processId, "cancelled");
        return;
      }

      if (
        !result ||
        !result.summary ||
        typeof result.summary !== "string" ||
        result.summary.trim().length === 0
      ) {
        console.error(`[API] Invalid or empty summary received from AI (${requestId})`);
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
        return;
      }

      const responseData = buildSummarizationResponse(
        result,
        text,
        processingTime,
        processId,
      );

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

      if (isClientDisconnected(res)) {
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

    if (isClientDisconnected(res)) {
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
  }
}
