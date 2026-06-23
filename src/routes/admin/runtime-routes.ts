import type { Request, Response, Router } from "express";
import configService from "../../services/config/config-service.js";
import { getStageConcurrencyState } from "../../services/summarize/stage-concurrency.js";
import { getSummarizeQueueState } from "../../services/summarize/summarize-queue.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";

export function registerAdminRuntimeReadRoutes(router: Router): void {
  router.get(
    "/runtime-settings",
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const runtimeSettings = await configService.getRuntimeSettings();
        sendSuccess(res, { runtimeSettings });
      } catch (error) {
        sendError(res, 500, "Failed to load runtime settings");
      }
    },
  );

  router.get(
    "/ops/summarize-health",
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const runtimeSettings = await configService.getRuntimeSettings();
        const globalConfig = await configService.getGlobalConfig();

        sendSuccess(res, {
          timestamp: new Date().toISOString(),
          features: {
            pipelineMode: "v2_always_on",
            targetedRepairControl: "runtime.repair.enabled",
          },
          activeProvider: globalConfig.provider,
          summarizeQueue: getSummarizeQueueState(),
          stageConcurrency: getStageConcurrencyState(),
          runtimeSettings,
        });
      } catch (error) {
        sendError(res, 500, "Failed to load summarize health snapshot");
      }
    },
  );
}
