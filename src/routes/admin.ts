/**
 * Admin Routes (DB-backed config)
 */

import express, { Request, Response } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { adminAuthLimiter, requireAdminAuth } from "../middleware/admin-auth.js";
import {
  sendError,
  sendSuccess,
  sendValidationError,
} from "../utils/api/api-responses.js";
import configService, {
  type PromptName,
  type ProviderName,
} from "../services/config/config-service.js";
import { getPrismaClient } from "../config/database/prisma-client.js";
import {
  GEMINI_MODEL_WHITELIST,
  normalizeGeminiModel,
} from "../config/ai/model-whitelist.js";
import {
  AI_PROVIDERS,
  type AIProvider,
  getProviderConfig,
} from "../config/ai/ai-config.js";
import {
  encryptSecretValue,
  maskSecretValue,
} from "../utils/crypto/encryption.js";
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  validateBackupPayload,
} from "../services/config/backup-schema.js";
import {
  createTaskDefinition,
  getTaskDefinitionByKey,
  listTaskDefinitions,
  reorderTaskDefinitions,
  updateTaskDefinition,
} from "../services/tasks/task-catalog-service.js";
import {
  getTargetAudienceCatalog,
  saveTargetAudienceCatalog,
  validateTargetAudienceCatalogInput,
} from "../services/target-audiences/target-audience-catalog-service.js";
import { config } from "../config/app-config.js";
import { getSummarizeQueueState } from "../services/summarize/summarize-queue.js";
import { getStageConcurrencyState } from "../services/summarize/stage-concurrency.js";
import { getAutoProfileControllerStatus } from "../services/summarize/auto-profile-controller.js";

const router = express.Router();
const prisma = getPrismaClient();

const PROMPT_NAMES = new Set<PromptName>([
  "role",
  "importantRules",
  "senderIntent",
  "targetAudience",
  "task",
  "rewritePlan",
  "qualityEvaluation",
  "wordListUsage",
  "rewriteFallback",
]);

const GLOBAL_CONFIG_KEY = "global";
const DEFAULT_RETRY_COUNT = 5;
const TARGET_AUDIENCE_PREFIX = "targetAudience:";
const TASK_PROMPT_PREFIX = "task:";
const SYSTEM_PROMPT_NAMES = [
  "role",
  "importantRules",
  "senderIntent",
  "rewritePlan",
  "qualityEvaluation",
  "wordListUsage",
  "rewriteFallback",
] as const;

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getActor(req: Request): string {
  const headerValue = req.header("x-admin-actor");
  if (headerValue && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  return "admin";
}

function isPromptName(name: string): name is PromptName {
  return PROMPT_NAMES.has(name as PromptName);
}

function isTargetAudiencePromptName(name: string): boolean {
  if (!name.startsWith(TARGET_AUDIENCE_PREFIX)) {
    return false;
  }

  const suffix = name.slice(TARGET_AUDIENCE_PREFIX.length).trim();
  return suffix.length > 0;
}

function getTaskKeyFromPromptName(name: string): string | null {
  if (!name.startsWith(TASK_PROMPT_PREFIX)) {
    return null;
  }

  const suffix = name.slice(TASK_PROMPT_PREFIX.length).trim();
  if (suffix.length === 0) {
    return null;
  }

  return suffix;
}

function getTargetAudienceName(name: string): string {
  return name.slice(TARGET_AUDIENCE_PREFIX.length).trim();
}

function getTaskServiceErrorStatus(message: string): number {
  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("already exists")) {
    return 409;
  }

  return 400;
}

async function logAudit(
  client: Prisma.TransactionClient | PrismaClient,
  action: string,
  actor: string,
  entity: string,
  entityId: string | null,
  diff?: Prisma.InputJsonValue,
): Promise<void> {
  await client.auditLog.create({
    data: {
      action,
      actor,
      entity,
      entityId,
      diff,
    },
  });
}

function readRewritePlanTasks(
  value: unknown,
): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, boolean> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, candidate]) => {
    if (typeof candidate === "boolean") {
      result[key] = candidate;
    }
  });
  return result;
}

function normalizeRuntimeSettings(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  try {
    const normalized = JSON.parse(
      JSON.stringify(value),
    ) as Record<string, unknown>;
    if (!normalized || Array.isArray(normalized)) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function jsonValueOrUndefined(
  value: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

async function setRewritePlanTaskToggle(
  client: Prisma.TransactionClient | PrismaClient,
  actor: string,
  taskKey: string,
  enabled: boolean,
): Promise<Record<string, boolean>> {
  const existingGlobal = await client.globalConfig.findUnique({
    where: { configKey: GLOBAL_CONFIG_KEY },
  });

  const rewritePlanTasks = {
    ...readRewritePlanTasks(existingGlobal?.rewritePlanTasks),
    [taskKey]: enabled,
  };

  await client.globalConfig.upsert({
    where: { configKey: GLOBAL_CONFIG_KEY },
    create: {
      configKey: GLOBAL_CONFIG_KEY,
      provider: existingGlobal?.provider ?? AI_PROVIDERS.GEMINI_2_5_FLASH,
      retryCount: existingGlobal?.retryCount ?? DEFAULT_RETRY_COUNT,
      rewritePlanTasks,
      updatedBy: actor,
    },
    update: {
      rewritePlanTasks,
      updatedBy: actor,
    },
  });

  return rewritePlanTasks;
}

async function removeRewritePlanTaskToggle(
  client: Prisma.TransactionClient | PrismaClient,
  actor: string,
  taskKey: string,
): Promise<Record<string, boolean>> {
  const existingGlobal = await client.globalConfig.findUnique({
    where: { configKey: GLOBAL_CONFIG_KEY },
  });
  if (!existingGlobal) {
    return {};
  }

  const rewritePlanTasks = readRewritePlanTasks(existingGlobal.rewritePlanTasks);
  if (!(taskKey in rewritePlanTasks)) {
    return rewritePlanTasks;
  }

  delete rewritePlanTasks[taskKey];

  await client.globalConfig.update({
    where: { configKey: GLOBAL_CONFIG_KEY },
    data: {
      rewritePlanTasks,
      updatedBy: actor,
    },
  });

  return rewritePlanTasks;
}

router.use(adminAuthLimiter);
router.use(requireAdminAuth);

router.get("/tasks", async (_req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await listTaskDefinitions();
    sendSuccess(res, tasks);
  } catch (error) {
    sendError(res, 500, "Failed to load tasks");
  }
});

router.post("/tasks", async (req: Request, res: Response): Promise<void> => {
  try {
    const label =
      typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (!label) {
      sendError(res, 400, "Task label is required");
      return;
    }

    const targetAudienceEnabled =
      readOptionalBoolean(req.body?.targetAudienceEnabled);
    const rewritePlanEnabled =
      readOptionalBoolean(req.body?.rewritePlanEnabled);

    const settings: Record<string, unknown> = {};
    if (targetAudienceEnabled !== undefined) {
      settings.targetAudienceEnabled = targetAudienceEnabled;
    }
    if (rewritePlanEnabled !== undefined) {
      settings.rewritePlanEnabled = rewritePlanEnabled;
    }

    const actor = getActor(req);
    const promptContentInput = req.body?.promptContent;
    if (promptContentInput !== undefined && typeof promptContentInput !== "string") {
      sendError(res, 400, "Invalid promptContent");
      return;
    }

    const fallbackPrompt = await configService.getPrompt("task");
    const taskPromptContent =
      typeof promptContentInput === "string" ? promptContentInput : fallbackPrompt;

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const task = await createTaskDefinition(
        {
          label,
          description: req.body?.description,
          enabled: req.body?.enabled,
          settings,
        },
        tx,
      );

      const promptName = `${TASK_PROMPT_PREFIX}${task.key}`;
      const latestPrompt = await tx.promptTemplate.findFirst({
        where: { name: promptName },
        orderBy: { version: "desc" },
      });
      const nextVersion = latestPrompt ? latestPrompt.version + 1 : 1;

      await tx.promptTemplate.updateMany({
        where: { name: promptName, isActive: true },
        data: { isActive: false },
      });

      const prompt = await tx.promptTemplate.create({
        data: {
          name: promptName,
          content: taskPromptContent,
          version: nextVersion,
          isActive: true,
          updatedBy: actor,
        },
      });

      await logAudit(tx, "task.create", actor, "task_definition", task.key, {
        key: task.key,
        label: task.label,
        enabled: task.enabled,
        sortOrder: task.sortOrder,
        outputMode: task.outputMode,
        bulletCount: task.bulletCount,
        maxChars: task.maxChars,
        targetAudienceEnabled: task.targetAudienceEnabled,
        rewritePlanEnabled: task.rewritePlanEnabled,
      });

      await logAudit(tx, "prompt.update", actor, "prompt_template", promptName, {
        name: prompt.name,
        version: prompt.version,
      });

      await setRewritePlanTaskToggle(
        tx,
        actor,
        task.key,
        task.rewritePlanEnabled,
      );

      return task;
    });

    configService.refresh();
    sendSuccess(res, created, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid task payload";
    const status = getTaskServiceErrorStatus(message);
    sendError(res, status, message);
  }
});

router.put(
  "/tasks/reorder",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const taskKeys = req.body?.taskKeys;
      if (!Array.isArray(taskKeys)) {
        sendError(res, 400, "taskKeys must be an array");
        return;
      }

      const reordered = await reorderTaskDefinitions(taskKeys);
      const actor = getActor(req);
      await logAudit(prisma, "task.reorder", actor, "task_definition", null, {
        taskKeys,
      });

      sendSuccess(res, reordered);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid task reorder payload";
      const status = getTaskServiceErrorStatus(message);
      sendError(res, status, message);
    }
  },
);

router.put(
  "/tasks/:taskKey",
  async (req: Request, res: Response): Promise<void> => {
    const rawTaskKey = req.params.taskKey;
    const taskKey = Array.isArray(rawTaskKey) ? rawTaskKey[0] : rawTaskKey;

    if (!taskKey || taskKey.trim().length === 0) {
      sendError(res, 400, "Invalid taskKey");
      return;
    }

    try {
      const targetAudienceEnabled =
        readOptionalBoolean(req.body?.targetAudienceEnabled);
      const rewritePlanEnabled =
        readOptionalBoolean(req.body?.rewritePlanEnabled);

      const settings: Record<string, unknown> = {};
      if (targetAudienceEnabled !== undefined) {
        settings.targetAudienceEnabled = targetAudienceEnabled;
      }
      if (rewritePlanEnabled !== undefined) {
        settings.rewritePlanEnabled = rewritePlanEnabled;
      }

      const updated = await updateTaskDefinition(taskKey, {
        label: req.body?.label,
        description: req.body?.description,
        enabled: req.body?.enabled,
        settings,
      });

      const actor = getActor(req);
      await logAudit(prisma, "task.update", actor, "task_definition", updated.key, {
        key: updated.key,
        label: updated.label,
        enabled: updated.enabled,
        sortOrder: updated.sortOrder,
        outputMode: updated.outputMode,
        bulletCount: updated.bulletCount,
        maxChars: updated.maxChars,
        targetAudienceEnabled: updated.targetAudienceEnabled,
        rewritePlanEnabled: updated.rewritePlanEnabled,
      });

      if (rewritePlanEnabled !== undefined) {
        await setRewritePlanTaskToggle(prisma, actor, updated.key, rewritePlanEnabled);
        await logAudit(
          prisma,
          "rewrite_plan_task.update",
          actor,
          "global_config",
          GLOBAL_CONFIG_KEY,
          {
            taskKey: updated.key,
            enabled: rewritePlanEnabled,
          },
        );
      }

      configService.refresh();
      sendSuccess(res, updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid task payload";
      const status = getTaskServiceErrorStatus(message);
      sendError(res, status, message);
    }
  },
);

router.delete(
  "/tasks/:taskKey",
  async (req: Request, res: Response): Promise<void> => {
    const rawTaskKey = req.params.taskKey;
    const taskKey = Array.isArray(rawTaskKey) ? rawTaskKey[0] : rawTaskKey;

    if (!taskKey || taskKey.trim().length === 0) {
      sendError(res, 400, "Invalid taskKey");
      return;
    }

    try {
      const actor = getActor(req);
      const existing = await getTaskDefinitionByKey(taskKey);
      if (!existing) {
        sendError(res, 404, `Task not found: ${taskKey}`);
        return;
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.taskDefinition.delete({ where: { key: existing.key } });

        await tx.promptTemplate.updateMany({
          where: {
            name: `${TASK_PROMPT_PREFIX}${existing.key}`,
            isActive: true,
          },
          data: { isActive: false, updatedBy: actor },
        });

        await removeRewritePlanTaskToggle(tx, actor, existing.key);

        await logAudit(tx, "task.delete", actor, "task_definition", existing.key, {
          key: existing.key,
        });
      });

      configService.refresh();

      sendSuccess(res, { key: taskKey, deleted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete task";
      const status = getTaskServiceErrorStatus(message);
      sendError(res, status, message);
    }
  },
);

router.get(
  "/target-audience-catalog",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const catalog = await getTargetAudienceCatalog(prisma);
      sendSuccess(res, catalog);
    } catch (error) {
      sendError(res, 500, "Failed to load target audience catalog");
    }
  },
);

router.put(
  "/target-audience-catalog",
  async (req: Request, res: Response): Promise<void> => {
    const candidate = req.body?.catalog ?? req.body;
    const validation = validateTargetAudienceCatalogInput(candidate);
    if (!validation.ok) {
      sendValidationError(res, validation.errors);
      return;
    }

    try {
      const actor = getActor(req);
      const saved = await saveTargetAudienceCatalog(validation.value, actor, prisma);

      await logAudit(
        prisma,
        "target_audience_catalog.update",
        actor,
        "global_config",
        GLOBAL_CONFIG_KEY,
        toInputJsonValue(saved),
      );

      configService.refresh();
      sendSuccess(res, saved);
    } catch (error) {
      sendError(res, 500, "Failed to update target audience catalog");
    }
  },
);

router.get("/config", async (_req: Request, res: Response): Promise<void> => {
  try {
    const prompts = await configService.getAllPrompts();
    const geminiConfig = await configService.getProviderConfig("gemini");
    const globalConfig = await configService.getGlobalConfig();

    sendSuccess(res, {
      prompts,
      global: globalConfig,
      providers: {
        gemini: geminiConfig,
      },
    });
  } catch (error) {
    sendError(res, 500, "Failed to load admin config");
  }
});

router.get("/backup", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      geminiConfig,
      globalConfig,
      targetAudienceCatalog,
      ordlistaEntries,
      activePrompts,
      taskDefinitions,
    ] = await Promise.all([
      configService.getProviderConfig("gemini"),
      configService.getGlobalConfig(),
      getTargetAudienceCatalog(prisma),
      prisma.ordlistaEntry.findMany({ orderBy: { fromWord: "asc" } }),
      prisma.promptTemplate.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.taskDefinition.findMany({
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
    ]);

    const activePromptMap = new Map<string, string>();
    for (const prompt of activePrompts) {
      activePromptMap.set(prompt.name, prompt.content);
    }

    const systemPromptMap = new Map<string, string>();
    for (const prompt of activePrompts) {
      if (isTargetAudiencePromptName(prompt.name)) {
        continue;
      }
      if (getTaskKeyFromPromptName(prompt.name)) {
        continue;
      }
      if (prompt.name === "task") {
        continue;
      }
      systemPromptMap.set(prompt.name, prompt.content);
    }

    for (const name of SYSTEM_PROMPT_NAMES) {
      if (!systemPromptMap.has(name)) {
        systemPromptMap.set(name, await configService.getPrompt(name));
      }
    }

    const systemPrompts = Array.from(systemPromptMap.entries())
      .map(([name, content]) => ({ name, content }))
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));

    const targetAudienceCategories = targetAudienceCatalog.categories;

    const targetAudiences = await Promise.all(
      targetAudienceCatalog.audiences.map(async (audience) => ({
        label: audience.label,
        category: audience.category,
        sortOrder: audience.sortOrder,
        prompt: {
          content:
            activePromptMap.get(`${TARGET_AUDIENCE_PREFIX}${audience.label}`) ||
            (await configService.getPrompt("targetAudience", {
              targetAudience: audience.label,
            })),
        },
      })),
    );

    const tasks = await Promise.all(
      taskDefinitions.map(async (task) => ({
        label: task.label,
        description: task.description,
        enabled: task.enabled,
        sortOrder: task.sortOrder,
        targetAudienceEnabled: task.targetAudienceEnabled,
        rewritePlanEnabled: task.rewritePlanEnabled,
        prompt: {
          content:
            activePromptMap.get(`${TASK_PROMPT_PREFIX}${task.key}`) ||
            (await configService.getPrompt("task", { taskKey: task.key })),
        },
      })),
    );

    res.set("Cache-Control", "no-store");
    res.status(200).json({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      app: BACKUP_APP_ID,
      exportedAt: new Date().toISOString(),
      settings: {
        global: {
          provider: globalConfig.provider,
          retryCount: globalConfig.retryCount,
          runtimeSettings: globalConfig.runtimeSettings,
        },
        providers: {
          gemini: {
            model: geminiConfig.model,
            temperature: geminiConfig.temperature,
            maxOutputTokens: geminiConfig.maxOutputTokens,
            useWebSearch: geminiConfig.useWebSearch,
            useThinking: geminiConfig.useThinking,
          },
        },
        systemPrompts,
        targetAudienceCategories,
        targetAudiences,
        tasks,
        ordlista: ordlistaEntries.map((entry) => ({
          fromWord: entry.fromWord,
          toWord: entry.toWord,
        })),
      },
    });
  } catch (error) {
    sendError(res, 500, "Failed to export backup");
  }
});

router.post("/backup", async (req: Request, res: Response): Promise<void> => {
  const result = validateBackupPayload(req.body);
  if (!result.ok) {
    sendValidationError(res, result.errors);
    return;
  }

  const payload = result.payload;
  const actor = getActor(req);
  let importedPromptCount = 0;

  try {
    const systemPromptEntries = payload.settings.systemPrompts;
    const targetAudienceCategoryEntries = payload.settings.targetAudienceCategories;
    const targetAudienceEntries = payload.settings.targetAudiences;
    const ordlistaEntries = payload.settings.ordlista;
    const taskEntries = payload.settings.tasks;
    const geminiModel = normalizeGeminiModel(
      payload.settings.providers.gemini.model,
    );
    const runtimeSettings =
      payload.settings.global.runtimeSettings ??
      ({} as Record<string, unknown>);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.globalConfig.upsert({
        where: { configKey: GLOBAL_CONFIG_KEY },
        create: {
          configKey: GLOBAL_CONFIG_KEY,
          provider: payload.settings.global.provider,
          retryCount: payload.settings.global.retryCount,
          rewritePlanTasks: {},
          runtimeSettings: toInputJsonValue(runtimeSettings),
          updatedBy: actor,
        },
        update: {
          provider: payload.settings.global.provider,
          retryCount: payload.settings.global.retryCount,
          rewritePlanTasks: {},
          runtimeSettings: toInputJsonValue(runtimeSettings),
          updatedBy: actor,
        },
      });

      const createProviderData = {
        provider: "gemini",
        model: geminiModel,
        temperature: payload.settings.providers.gemini.temperature,
        maxOutputTokens: payload.settings.providers.gemini.maxOutputTokens,
        useWebSearch: payload.settings.providers.gemini.useWebSearch,
        useThinking: payload.settings.providers.gemini.useThinking,
      } as Prisma.ProviderConfigUncheckedCreateInput;

      const updateProviderData = {
        model: geminiModel,
        temperature: payload.settings.providers.gemini.temperature,
        maxOutputTokens: payload.settings.providers.gemini.maxOutputTokens,
        useWebSearch: payload.settings.providers.gemini.useWebSearch,
        useThinking: payload.settings.providers.gemini.useThinking,
      } as Prisma.ProviderConfigUncheckedUpdateInput;

      await tx.providerConfig.upsert({
        where: { provider: "gemini" },
        create: createProviderData,
        update: updateProviderData,
      });

      await tx.taskDefinition.deleteMany();
      const createdTaskRecords: Array<{
        key: string;
        rewritePlanEnabled: boolean;
        promptContent: string;
      }> = [];
      for (const task of [...taskEntries].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const created = await createTaskDefinition(
          {
            label: task.label,
            description: task.description,
            enabled: task.enabled,
            sortOrder: task.sortOrder,
            settings: {
              targetAudienceEnabled: task.targetAudienceEnabled,
              rewritePlanEnabled: task.rewritePlanEnabled,
            },
          },
          tx,
        );

        createdTaskRecords.push({
          key: created.key,
          rewritePlanEnabled: task.rewritePlanEnabled,
          promptContent: task.prompt.content,
        });
      }

      const rewritePlanTasks = Object.fromEntries(
        createdTaskRecords.map((task) => [task.key, task.rewritePlanEnabled]),
      );

      await tx.globalConfig.update({
        where: { configKey: GLOBAL_CONFIG_KEY },
        data: {
          rewritePlanTasks,
          updatedBy: actor,
        },
      });

      const promptEntries = [
        ...systemPromptEntries,
        ...targetAudienceEntries.map((entry) => ({
          name: `${TARGET_AUDIENCE_PREFIX}${entry.label}`,
          content: entry.prompt.content,
        })),
        ...createdTaskRecords.map((task) => ({
          name: `${TASK_PROMPT_PREFIX}${task.key}`,
          content: task.promptContent,
        })),
      ];
      importedPromptCount = promptEntries.length;
      const promptNames = promptEntries.map((entry) => entry.name);

      await tx.promptTemplate.updateMany({
        where: {
          isActive: true,
          name: promptNames.length > 0 ? { notIn: promptNames } : undefined,
        },
        data: { isActive: false },
      });

      for (const prompt of promptEntries) {
        const latestPrompt = await tx.promptTemplate.findFirst({
          where: { name: prompt.name },
          orderBy: { version: "desc" },
        });

        const nextVersion = latestPrompt ? latestPrompt.version + 1 : 1;

        await tx.promptTemplate.updateMany({
          where: { name: prompt.name, isActive: true },
          data: { isActive: false },
        });

        await tx.promptTemplate.create({
          data: {
            name: prompt.name,
            content: prompt.content,
            version: nextVersion,
            isActive: true,
            updatedBy: actor,
          },
        });
      }

      await tx.ordlistaEntry.deleteMany();
      if (ordlistaEntries.length > 0) {
        await tx.ordlistaEntry.createMany({
          data: ordlistaEntries.map((entry) => ({
            fromWord: entry.fromWord,
            toWord: entry.toWord,
            updatedBy: actor,
          })),
        });
      }

      await saveTargetAudienceCatalog(
        {
          categories: targetAudienceCategoryEntries,
          audiences: targetAudienceEntries.map((entry) => ({
            label: entry.label,
            category: entry.category,
            sortOrder: entry.sortOrder,
          })),
        },
        actor,
        tx,
      );

      await logAudit(
        tx,
        "backup.import",
        actor,
        "backup",
        payload.exportedAt,
        {
          prompts: promptEntries.length,
          tasks: taskEntries.length,
          ordlista: ordlistaEntries.length,
          targetAudienceCategories: targetAudienceCategoryEntries.length,
          targetAudiences: targetAudienceEntries.length,
          provider: payload.settings.global.provider,
          retryCount: payload.settings.global.retryCount,
          rewritePlanTasks,
          runtimeSettings: toInputJsonValue(runtimeSettings),
          geminiModel,
          useWebSearch: payload.settings.providers.gemini.useWebSearch,
          useThinking: payload.settings.providers.gemini.useThinking,
        },
      );
    });

    configService.refresh();
    sendSuccess(res, {
      imported: {
        prompts: importedPromptCount,
        tasks: taskEntries.length,
        ordlista: ordlistaEntries.length,
      },
    });
  } catch (error) {
    sendError(res, 500, "Failed to import backup");
  }
});

router.get(
  "/prompts/:name",
  async (req: Request, res: Response): Promise<void> => {
    const rawName = req.params.name;
    const promptName = Array.isArray(rawName) ? rawName[0] : rawName;

    if (!promptName) {
      sendError(res, 404, "Prompt not found");
      return;
    }

    try {
      if (isTargetAudiencePromptName(promptName)) {
        const audience = getTargetAudienceName(promptName);
        const content = await configService.getPrompt("targetAudience", {
          targetAudience: audience,
        });
        sendSuccess(res, { name: promptName, content });
        return;
      }

      const taskKey = getTaskKeyFromPromptName(promptName);
      if (taskKey) {
        const task = await getTaskDefinitionByKey(taskKey);
        if (!task) {
          sendError(res, 404, "Prompt not found");
          return;
        }

        const activePrompt = await prisma.promptTemplate.findFirst({
          where: { name: promptName, isActive: true },
          orderBy: { version: "desc" },
        });
        if (activePrompt) {
          sendSuccess(res, { name: promptName, content: activePrompt.content });
          return;
        }

        sendSuccess(res, { name: promptName, content: "" });
        return;
      }

      if (!isPromptName(promptName)) {
        sendError(res, 404, "Prompt not found");
        return;
      }

      const content = await configService.getPrompt(promptName);
      sendSuccess(res, { name: promptName, content });
    } catch (error) {
      sendError(res, 500, "Failed to load prompt");
    }
  },
);

router.put(
  "/prompts/:name",
  async (req: Request, res: Response): Promise<void> => {
    const rawName = req.params.name;
    const promptName = Array.isArray(rawName) ? rawName[0] : rawName;

    if (!promptName) {
      sendError(res, 404, "Prompt not found");
      return;
    }

    const content = req.body?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      sendError(res, 400, "Invalid prompt content");
      return;
    }

    try {
      const taskKey = getTaskKeyFromPromptName(promptName);
      if (taskKey) {
        const task = await getTaskDefinitionByKey(taskKey);
        if (!task) {
          sendError(res, 404, "Prompt not found");
          return;
        }
      } else if (!isPromptName(promptName) && !isTargetAudiencePromptName(promptName)) {
        sendError(res, 404, "Prompt not found");
        return;
      }

      const actor = getActor(req);
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const latestPrompt = await tx.promptTemplate.findFirst({
          where: { name: promptName },
          orderBy: { version: "desc" },
        });

        const nextVersion = latestPrompt ? latestPrompt.version + 1 : 1;

        await tx.promptTemplate.updateMany({
          where: { name: promptName, isActive: true },
          data: { isActive: false },
        });

        const created = await tx.promptTemplate.create({
          data: {
            name: promptName,
            content,
            version: nextVersion,
            isActive: true,
            updatedBy: actor,
          },
        });

        await logAudit(
          tx,
          "prompt.update",
          actor,
          "prompt_template",
          `${promptName}:${nextVersion}`,
          {
            name: promptName,
            version: nextVersion,
          },
        );

        return created;
      });

      configService.refresh();
      sendSuccess(res, {
        name: result.name,
        version: result.version,
        content: result.content,
        isActive: result.isActive,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      sendError(res, 500, "Failed to update prompt");
    }
  },
);

router.put(
  "/task-prompts/:taskKey",
  async (req: Request, res: Response): Promise<void> => {
    const rawTaskKey = req.params.taskKey;
    const taskKey = Array.isArray(rawTaskKey) ? rawTaskKey[0] : rawTaskKey;
    const content = req.body?.content;
    const rewritePlanEnabled = req.body?.rewritePlanEnabled;

    if (typeof content !== "string" || content.trim().length === 0) {
      sendError(res, 400, "Invalid prompt content");
      return;
    }

    if (typeof rewritePlanEnabled !== "boolean") {
      sendError(res, 400, "Invalid rewritePlanEnabled flag");
      return;
    }

    if (typeof taskKey !== "string" || taskKey.trim().length === 0) {
      sendError(res, 400, "Invalid taskKey");
      return;
    }

    try {
      const task = await getTaskDefinitionByKey(taskKey);
      if (!task) {
        sendError(res, 400, "Invalid taskKey");
        return;
      }

      const actor = getActor(req);
      const promptName = `${TASK_PROMPT_PREFIX}${taskKey}`;

      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const latestPrompt = await tx.promptTemplate.findFirst({
          where: { name: promptName },
          orderBy: { version: "desc" },
        });

        const nextVersion = latestPrompt ? latestPrompt.version + 1 : 1;

        await tx.promptTemplate.updateMany({
          where: { name: promptName, isActive: true },
          data: { isActive: false },
        });

        const createdPrompt = await tx.promptTemplate.create({
          data: {
            name: promptName,
            content,
            version: nextVersion,
            isActive: true,
            updatedBy: actor,
          },
        });

        await logAudit(
          tx,
          "prompt.update",
          actor,
          "prompt_template",
          `${promptName}:${nextVersion}`,
          {
            name: promptName,
            version: nextVersion,
          },
        );

        const nextRewritePlanTasks = await setRewritePlanTaskToggle(
          tx,
          actor,
          taskKey,
          rewritePlanEnabled,
        );

        await tx.taskDefinition.update({
          where: { key: taskKey },
          data: { rewritePlanEnabled },
        });

        await logAudit(
          tx,
          "rewrite_plan_task.update",
          actor,
          "global_config",
          GLOBAL_CONFIG_KEY,
          {
            taskKey,
            enabled: rewritePlanEnabled,
          },
        );

        return {
          prompt: createdPrompt,
          rewritePlanTasks: nextRewritePlanTasks,
        };
      });

      configService.refresh();

      sendSuccess(res, {
        taskKey,
        prompt: {
          name: result.prompt.name,
          version: result.prompt.version,
          content: result.prompt.content,
          isActive: result.prompt.isActive,
          updatedAt: result.prompt.updatedAt,
        },
        rewritePlanTasks: result.rewritePlanTasks,
      });
    } catch (error) {
      sendError(res, 500, "Failed to update task prompt settings");
    }
  },
);

router.put(
  "/config/global",
  async (req: Request, res: Response): Promise<void> => {
    const { provider, retryCount } = req.body ?? {};

    if (provider === undefined && retryCount === undefined) {
      sendError(res, 400, "Missing global config values");
      return;
    }

    let normalizedProvider: AIProvider | null = null;
    if (provider !== undefined) {
      if (typeof provider !== "string") {
        sendError(res, 400, "Invalid provider");
        return;
      }

      if (!Object.values(AI_PROVIDERS).includes(provider as AIProvider)) {
        sendError(res, 400, "Unsupported provider");
        return;
      }

      normalizedProvider = provider as AIProvider;
    }

    let normalizedRetryCount: number | null = null;
    if (retryCount !== undefined) {
      if (!Number.isInteger(retryCount) || retryCount < 1 || retryCount > 10) {
        sendError(res, 400, "Invalid retryCount");
        return;
      }
      normalizedRetryCount = retryCount;
    }

    try {
      const actor = getActor(req);
      const existing = await prisma.globalConfig.findUnique({
        where: { configKey: GLOBAL_CONFIG_KEY },
      });

      const updated = await prisma.globalConfig.upsert({
        where: { configKey: GLOBAL_CONFIG_KEY },
        create: {
          configKey: GLOBAL_CONFIG_KEY,
          provider: normalizedProvider || AI_PROVIDERS.GEMINI_2_5_FLASH,
          retryCount: normalizedRetryCount ?? DEFAULT_RETRY_COUNT,
          updatedBy: actor,
        },
        update: {
          provider: normalizedProvider ?? existing?.provider ?? AI_PROVIDERS.GEMINI_2_5_FLASH,
          retryCount: normalizedRetryCount ?? existing?.retryCount ?? DEFAULT_RETRY_COUNT,
          updatedBy: actor,
        },
      });

      await logAudit(
        prisma,
        "global.update",
        actor,
        "global_config",
        GLOBAL_CONFIG_KEY,
        {
          provider: updated.provider,
          retryCount: updated.retryCount,
        },
      );

      configService.refresh();
      sendSuccess(res, {
        provider: updated.provider,
        retryCount: updated.retryCount,
      });
    } catch (error) {
      sendError(res, 500, "Failed to update global config");
    }
  },
);

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
          sharedLimiter: config.features.sharedLimiter,
        },
        activeProvider: globalConfig.provider,
        summarizeQueue: getSummarizeQueueState(),
        stageConcurrency: getStageConcurrencyState(),
        autoProfile: getAutoProfileControllerStatus(),
        runtimeSettings,
      });
    } catch (error) {
      sendError(res, 500, "Failed to load summarize health snapshot");
    }
  },
);

router.put(
  "/runtime-settings",
  async (req: Request, res: Response): Promise<void> => {
    const candidate = req.body?.runtimeSettings ?? req.body;
    const runtimeSettings = normalizeRuntimeSettings(candidate);

    if (!runtimeSettings) {
      sendError(res, 400, "Invalid runtime settings payload");
      return;
    }

    try {
      const actor = getActor(req);
      const existing = await prisma.globalConfig.findUnique({
        where: { configKey: GLOBAL_CONFIG_KEY },
      });

      await prisma.globalConfig.upsert({
        where: { configKey: GLOBAL_CONFIG_KEY },
        create: {
          configKey: GLOBAL_CONFIG_KEY,
          provider: existing?.provider ?? AI_PROVIDERS.GEMINI_2_5_FLASH,
          retryCount: existing?.retryCount ?? DEFAULT_RETRY_COUNT,
          rewritePlanTasks: jsonValueOrUndefined(existing?.rewritePlanTasks),
          runtimeSettings: toInputJsonValue(runtimeSettings),
          updatedBy: actor,
        },
        update: {
          runtimeSettings: toInputJsonValue(runtimeSettings),
          updatedBy: actor,
        },
      });

      await logAudit(
        prisma,
        "runtime_settings.update",
        actor,
        "global_config",
        GLOBAL_CONFIG_KEY,
        runtimeSettings as Prisma.InputJsonValue,
      );

      configService.refresh();
      sendSuccess(res, { runtimeSettings });
    } catch (error) {
      sendError(res, 500, "Failed to update runtime settings");
    }
  },
);

router.get("/prompts", async (_req: Request, res: Response): Promise<void> => {
  try {
    const activePrompts = await prisma.promptTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    const response = activePrompts.map((prompt: {
      name: string;
      version: number;
      updatedAt: Date;
    }) => ({
      name: prompt.name,
      activeVersion: prompt.version,
      updatedAt: prompt.updatedAt,
    }));

    sendSuccess(res, response);
  } catch (error) {
    sendError(res, 500, "Failed to load prompts");
  }
});

router.get(
  "/prompts/:name/versions",
  async (req: Request, res: Response): Promise<void> => {
    const rawName = req.params.name;
    const promptName = Array.isArray(rawName) ? rawName[0] : rawName;

    try {
      if (!promptName) {
        sendError(res, 404, "Prompt not found");
        return;
      }

      const taskKey = getTaskKeyFromPromptName(promptName);
      if (taskKey) {
        const task = await getTaskDefinitionByKey(taskKey);
        if (!task) {
          sendError(res, 404, "Prompt not found");
          return;
        }
      } else if (!isPromptName(promptName) && !isTargetAudiencePromptName(promptName)) {
        sendError(res, 404, "Prompt not found");
        return;
      }

      const versions = await prisma.promptTemplate.findMany({
        where: { name: promptName },
        orderBy: { version: "desc" },
      });

      const response = versions.map((version: {
        version: number;
        updatedAt: Date;
        isActive: boolean;
      }) => ({
        version: version.version,
        updatedAt: version.updatedAt,
        isActive: version.isActive,
      }));

      sendSuccess(res, response);
    } catch (error) {
      sendError(res, 500, "Failed to load prompt versions");
    }
  },
);

router.post(
  "/prompts/:name/activate/:version",
  async (req: Request, res: Response): Promise<void> => {
    const rawName = req.params.name;
    const promptName = Array.isArray(rawName) ? rawName[0] : rawName;
    const rawVersion = req.params.version;
    const versionParam = Array.isArray(rawVersion) ? rawVersion[0] : rawVersion;
    const version = versionParam ? Number.parseInt(versionParam, 10) : NaN;

    if (!Number.isInteger(version) || version <= 0) {
      sendError(res, 400, "Invalid version");
      return;
    }

    try {
      if (!promptName) {
        sendError(res, 404, "Prompt not found");
        return;
      }

      const taskKey = getTaskKeyFromPromptName(promptName);
      if (taskKey) {
        const task = await getTaskDefinitionByKey(taskKey);
        if (!task) {
          sendError(res, 404, "Prompt not found");
          return;
        }
      } else if (!isPromptName(promptName) && !isTargetAudiencePromptName(promptName)) {
        sendError(res, 404, "Prompt not found");
        return;
      }

      const actor = getActor(req);
      const existing = await prisma.promptTemplate.findFirst({
        where: { name: promptName, version },
      });

      if (!existing) {
        sendError(res, 404, "Prompt version not found");
        return;
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.promptTemplate.updateMany({
          where: { name: promptName, isActive: true },
          data: { isActive: false },
        });

        await tx.promptTemplate.update({
          where: { id: existing.id },
          data: { isActive: true, updatedBy: actor },
        });

        await logAudit(
          tx,
          "prompt.activate",
          actor,
          "prompt_template",
          `${promptName}:${version}`,
          {
            name: promptName,
            version,
          },
        );
      });

      configService.refresh();
      sendSuccess(res, { name: promptName, version });
    } catch (error) {
      sendError(res, 500, "Failed to activate prompt version");
    }
  },
);

router.put(
  "/providers/gemini",
  async (req: Request, res: Response): Promise<void> => {
    const { model, temperature, maxOutputTokens, useWebSearch, useThinking } =
      req.body ?? {};

    if (typeof model !== "string" || model.trim().length === 0) {
      sendError(res, 400, "Invalid model");
      return;
    }

    if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
      sendError(res, 400, "Invalid temperature");
      return;
    }

    if (
      typeof maxOutputTokens !== "number" ||
      !Number.isInteger(maxOutputTokens) ||
      maxOutputTokens <= 0
    ) {
      sendError(res, 400, "Invalid maxOutputTokens");
      return;
    }

    const normalizedModel = normalizeGeminiModel(String(model));
    if (!GEMINI_MODEL_WHITELIST.has(normalizedModel)) {
      sendError(res, 400, "Unsupported model");
      return;
    }

    if (useWebSearch !== undefined && typeof useWebSearch !== "boolean") {
      sendError(res, 400, "Invalid useWebSearch");
      return;
    }

    if (useThinking !== undefined && typeof useThinking !== "boolean") {
      sendError(res, 400, "Invalid useThinking");
      return;
    }

    try {
      const actor = getActor(req);
      const provider: ProviderName = "gemini";
      const defaultProviderConfig = getProviderConfig(
        AI_PROVIDERS.GEMINI_2_5_FLASH,
      );
      const defaultUseWebSearch = Boolean(
        defaultProviderConfig.USE_GOOGLE_SEARCH_GROUNDING,
      );
      const defaultUseThinking =
        defaultProviderConfig.THINKING_BUDGET !== undefined &&
        defaultProviderConfig.THINKING_BUDGET !== 0;

      const existing = (await prisma.providerConfig.findUnique({
        where: { provider },
      })) as { useWebSearch?: boolean; useThinking?: boolean } | null;

      const nextUseWebSearch =
        typeof useWebSearch === "boolean"
          ? useWebSearch
          : existing?.useWebSearch ?? defaultUseWebSearch;
      const nextUseThinking =
        typeof useThinking === "boolean"
          ? useThinking
          : existing?.useThinking ?? defaultUseThinking;

      const createData = {
        provider,
        model: normalizedModel,
        temperature,
        maxOutputTokens,
        useWebSearch: nextUseWebSearch,
        useThinking: nextUseThinking,
      } as Prisma.ProviderConfigUncheckedCreateInput;

      const updateData = {
        model: normalizedModel,
        temperature,
        maxOutputTokens,
        useWebSearch: nextUseWebSearch,
        useThinking: nextUseThinking,
      } as Prisma.ProviderConfigUncheckedUpdateInput;

      const updated = await prisma.providerConfig.upsert({
        where: { provider },
        create: createData,
        update: updateData,
      });

      await logAudit(
        prisma,
        "provider.update",
        actor,
        "provider_config",
        provider,
        {
          provider,
          model: normalizedModel,
          temperature,
          maxOutputTokens,
          useWebSearch: nextUseWebSearch,
          useThinking: nextUseThinking,
        },
      );

      configService.refresh();
      const updatedConfig = updated as typeof updated & {
        useWebSearch: boolean;
        useThinking: boolean;
      };
      sendSuccess(res, {
        model: updatedConfig.model,
        temperature: updatedConfig.temperature,
        maxOutputTokens: updatedConfig.maxOutputTokens,
        useWebSearch: updatedConfig.useWebSearch,
        useThinking: updatedConfig.useThinking,
      });
    } catch (error) {
      sendError(res, 500, "Failed to update Gemini provider config");
    }
  },
);

router.put(
  "/secrets/:name",
  async (req: Request, res: Response): Promise<void> => {
    const rawName = req.params.name;
    const secretName = Array.isArray(rawName) ? rawName[0] : rawName;

    if (!secretName || secretName.trim().length === 0) {
      sendError(res, 400, "Invalid secret name");
      return;
    }

    const value = req.body?.value;
    if (typeof value !== "string" || value.trim().length === 0) {
      sendError(res, 400, "Invalid secret value");
      return;
    }

    try {
      const actor = getActor(req);
      const cipherText = encryptSecretValue(value);

      await prisma.secret.upsert({
        where: { name: secretName },
        create: {
          name: secretName,
          cipherText,
          updatedBy: actor,
        },
        update: {
          cipherText,
          updatedBy: actor,
        },
      });

      await logAudit(
        prisma,
        "secret.update",
        actor,
        "secret",
        secretName,
        { name: secretName, masked: maskSecretValue(value) },
      );

      configService.refresh();
      sendSuccess(res, {
        name: secretName,
        masked: maskSecretValue(value),
      });
    } catch (error) {
      sendError(res, 500, "Failed to update secret");
    }
  },
);

router.get(
  "/secrets",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const maskedSecrets = await configService.listMaskedSecrets();
      sendSuccess(res, maskedSecrets);
    } catch (error) {
      sendError(res, 500, "Failed to load secrets");
    }
  },
);

router.get("/ordlista", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set("Cache-Control", "no-store");
    const entries = await prisma.ordlistaEntry.findMany({
      orderBy: { fromWord: "asc" },
    });

    sendSuccess(
      res,
      entries.map((entry: {
        id: number;
        fromWord: string;
        toWord: string;
        updatedAt: Date;
        updatedBy: string | null;
      }) => ({
        id: entry.id,
        fromWord: entry.fromWord,
        toWord: entry.toWord,
        updatedAt: entry.updatedAt,
        updatedBy: entry.updatedBy,
      })),
    );
  } catch (error) {
    sendError(res, 500, "Failed to load ordlista");
  }
});

router.post("/ordlista", async (req: Request, res: Response): Promise<void> => {
  const { fromWord, toWord } = req.body ?? {};

  if (typeof fromWord !== "string" || fromWord.trim().length === 0) {
    sendError(res, 400, "Invalid fromWord");
    return;
  }

  if (typeof toWord !== "string" || toWord.trim().length === 0) {
    sendError(res, 400, "Invalid toWord");
    return;
  }

  try {
    const actor = getActor(req);
    const entry = await prisma.ordlistaEntry.upsert({
      where: { fromWord: fromWord.trim() },
      create: {
        fromWord: fromWord.trim(),
        toWord: toWord.trim(),
        updatedBy: actor,
      },
      update: {
        toWord: toWord.trim(),
        updatedBy: actor,
      },
    });

    await logAudit(prisma, "ordlista.upsert", actor, "ordlista_entries", String(entry.id), {
      fromWord: entry.fromWord,
      toWord: entry.toWord,
    });

    sendSuccess(res, {
      id: entry.id,
      fromWord: entry.fromWord,
      toWord: entry.toWord,
      updatedAt: entry.updatedAt,
      updatedBy: entry.updatedBy,
    });
  } catch (error) {
    sendError(res, 500, "Failed to save ordlista entry");
  }
});

router.delete(
  "/ordlista/:id",
  async (req: Request, res: Response): Promise<void> => {
    const rawId = req.params.id;
    const idValue = Array.isArray(rawId) ? rawId[0] : rawId;
    const id = idValue ? Number.parseInt(idValue, 10) : NaN;

    if (!Number.isInteger(id) || id <= 0) {
      sendError(res, 400, "Invalid ordlista id");
      return;
    }

    try {
      const actor = getActor(req);
      const existing = await prisma.ordlistaEntry.findUnique({
        where: { id },
      });
      if (!existing) {
        sendSuccess(res, { id, deleted: false });
        return;
      }

      await prisma.ordlistaEntry.delete({ where: { id } });

      await logAudit(
        prisma,
        "ordlista.delete",
        actor,
        "ordlista_entries",
        String(existing.id),
        {
          fromWord: existing.fromWord,
          toWord: existing.toWord,
        },
      );

      sendSuccess(res, {
        id: existing.id,
        fromWord: existing.fromWord,
        toWord: existing.toWord,
        deleted: true,
      });
    } catch (error) {
      sendError(res, 500, "Failed to delete ordlista entry");
    }
  },
);

router.delete("/ordlista", async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = getActor(req);
    const result = await prisma.ordlistaEntry.deleteMany();

    await logAudit(prisma, "ordlista.clear", actor, "ordlista_entries", null, {
      count: result.count,
    });

    sendSuccess(res, { deletedCount: result.count });
  } catch (error) {
    sendError(res, 500, "Failed to clear ordlista");
  }
});
export default router;
