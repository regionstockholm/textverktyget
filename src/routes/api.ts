/**
 * Public API routes.
 */

import express from "express";
import type { Request, Response } from "express";
import configService from "../services/config/config-service.js";
import {
  evaluateTextQuality,
  getTextQualityRecord,
  markRecordAsProcessing,
} from "../services/quality-evaluation-controls.js";
import {
  getSummarizeProgress,
  subscribeSummarizeProgress,
} from "../services/summarize/progress-tracker.js";
import { getTargetAudienceCatalog } from "../services/target-audiences/target-audience-catalog-service.js";
import { listTaskDefinitions } from "../services/tasks/task-catalog-service.js";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { validateQualityEvaluationRequest } from "../validators/quality-validator.js";
import { handleFetchWebRequest } from "./api/web-fetch-route.js";
import {
  handleSummarizeRequest,
  isTransientSummarizeError,
} from "./api/summarize-route.js";
import { normalizeClientProcessId } from "./api/process-id.js";
import { sendError, sendSuccess } from "../utils/api/api-responses.js";
import { rateLimiters } from "../utils/api/rate-limits.js";
import { logger } from "../utils/logger.js";

export { isTransientSummarizeError };

const router = express.Router();
const DEFAULT_MAX_QUALITY_ATTEMPTS = 5;
const prisma = getPrismaClient();

function writeSseEvent(
  res: Response,
  eventName: string,
  payload: unknown,
): void {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

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
    } catch {
      sendError(res, 500, "Failed to load target audiences");
    }
  },
);

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
            targetAudienceEnabled: task.targetAudienceEnabled,
            rewritePlanEnabled: task.rewritePlanEnabled,
          },
        })),
      );
    } catch {
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
    } catch {
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

router.post("/summarize", rateLimiters.summarize, handleSummarizeRequest);

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

      const record = await getTextQualityRecord(recordId);
      if (!record) {
        sendError(res, 404, "Record not found");
        return;
      }

      const locked = await markRecordAsProcessing(recordId);
      if (!locked) {
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

router.post("/fetch-web", rateLimiters.standard, handleFetchWebRequest);

export default router;
