/**
 * Public API routes.
 */

import express from "express";
import type { Request, Response } from "express";
import configService from "../services/config/config-service.js";
import {
  getSummarizeProgress,
  subscribeSummarizeProgress,
} from "../services/summarize/progress-tracker.js";
import { getTargetAudienceCatalog } from "../services/target-audiences/target-audience-catalog-service.js";
import { listTaskDefinitions } from "../services/tasks/task-catalog-service.js";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { handleFetchWebRequest } from "./api/web-fetch-route.js";
import {
  handleSummarizeRequest,
  isTransientSummarizeError,
} from "./api/summarize-route.js";
import { normalizeClientProcessId } from "./api/process-id.js";
import { sendError, sendSuccess } from "../utils/api/api-responses.js";
import { rateLimiters } from "../utils/api/rate-limits.js";
import { withAiJob } from "../config/ai/resolved-ai-config.js";

export { isTransientSummarizeError };

const router = express.Router();
router.use((_req, _res, next) => withAiJob(next));
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

    const close = (): void => {
      unsubscribe();
      clearInterval(heartbeatId);
      clearTimeout(startupTimeout);
      clearTimeout(lifetimeTimeout);
      req.off("close", close);
      if (!res.writableEnded) res.end();
    };
    const heartbeatId = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);
    // The browser opens its stream just before submitting the job.
    const startupTimeout = setTimeout(() => {
      if (!getSummarizeProgress(normalizedProcessId)) close();
    }, 30000);
    // shortcut: progress streams last at most 30 minutes; extend for longer supported jobs.
    const lifetimeTimeout = setTimeout(close, 30 * 60 * 1000);
    const sendSnapshot = (snapshot: NonNullable<ReturnType<typeof getSummarizeProgress>>): void => {
      writeSseEvent(res, "stage", snapshot);
      if (snapshot.isTerminal) close();
    };
    const unsubscribe = subscribeSummarizeProgress(normalizedProcessId, sendSnapshot);
    req.on("close", close);
    const snapshot = getSummarizeProgress(normalizedProcessId);
    if (snapshot) sendSnapshot(snapshot);
  },
);

router.post("/summarize", rateLimiters.summarize, handleSummarizeRequest);

router.post("/fetch-web", rateLimiters.standard, handleFetchWebRequest);

export default router;
