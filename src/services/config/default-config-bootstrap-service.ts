import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../config/database/prisma-client.js";
import { getDefaultConfig } from "../../config/default-config-loader.js";
import { createTaskDefinition } from "../tasks/task-catalog-service.js";
import {
  saveTargetAudienceCatalog,
  type TargetAudienceCatalog,
} from "../target-audiences/target-audience-catalog-service.js";

const GLOBAL_CONFIG_KEY = "global";
const TARGET_AUDIENCE_PREFIX = "targetAudience:";
const TASK_PROMPT_PREFIX = "task:";

export interface DefaultConfigBootstrapResult {
  applied: boolean;
  reason: "already-initialized" | "applied";
  promptsCreated: number;
  tasksCreated: number;
  ordlistaCreated: number;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function applyDefaultConfigIfDatabaseEmpty(
  actor: string = "startup",
): Promise<DefaultConfigBootstrapResult> {
  const prisma = getPrismaClient();
  const [promptCount, globalCount, providerCount, taskCount, ordlistaCount] =
    await Promise.all([
      prisma.promptTemplate.count(),
      prisma.globalConfig.count(),
      prisma.providerConfig.count(),
      prisma.taskDefinition.count(),
      prisma.ordlistaEntry.count(),
    ]);

  const hasInitializedConfig = globalCount > 0 || providerCount > 0;
  const hasAuxiliaryData = promptCount > 0 || ordlistaCount > 0;
  const hasTaskCatalog = taskCount > 0;

  const shouldRebuildFromDefault =
    !hasInitializedConfig &&
    (!hasAuxiliaryData || hasTaskCatalog);

  if (!shouldRebuildFromDefault) {
    return {
      applied: false,
      reason: "already-initialized",
      promptsCreated: 0,
      tasksCreated: 0,
      ordlistaCreated: 0,
    };
  }

  const config = getDefaultConfig();
  const runtimeSettings = config.settings.global.runtimeSettings ?? {};

  const createdTaskKeys: Array<{ key: string; rewritePlanEnabled: boolean; prompt: string }> =
    [];

  await prisma.$transaction(async (tx) => {
    if (taskCount > 0 || promptCount > 0 || ordlistaCount > 0) {
      await tx.promptTemplate.deleteMany({});
      await tx.taskDefinition.deleteMany({});
      await tx.ordlistaEntry.deleteMany({});
    }

    await tx.globalConfig.upsert({
      where: { configKey: GLOBAL_CONFIG_KEY },
      create: {
        configKey: GLOBAL_CONFIG_KEY,
        provider: config.settings.global.provider,
        retryCount: config.settings.global.retryCount,
        rewritePlanTasks: {},
        runtimeSettings: toInputJsonValue(runtimeSettings),
        updatedBy: actor,
      },
      update: {
        provider: config.settings.global.provider,
        retryCount: config.settings.global.retryCount,
        runtimeSettings: toInputJsonValue(runtimeSettings),
        updatedBy: actor,
      },
    });

    await tx.providerConfig.upsert({
      where: { provider: "gemini" },
      create: {
        provider: "gemini",
        model: config.settings.providers.gemini.model,
        temperature: config.settings.providers.gemini.temperature,
        maxOutputTokens: config.settings.providers.gemini.maxOutputTokens,
        useWebSearch: config.settings.providers.gemini.useWebSearch,
        useThinking: config.settings.providers.gemini.useThinking,
      },
      update: {
        model: config.settings.providers.gemini.model,
        temperature: config.settings.providers.gemini.temperature,
        maxOutputTokens: config.settings.providers.gemini.maxOutputTokens,
        useWebSearch: config.settings.providers.gemini.useWebSearch,
        useThinking: config.settings.providers.gemini.useThinking,
      },
    });

    for (const taskConfig of config.settings.tasks.sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )) {
      const createdTask = await createTaskDefinition(
        {
          label: taskConfig.label,
          description: taskConfig.description,
          enabled: taskConfig.enabled,
          sortOrder: taskConfig.sortOrder,
          settings: {
            targetAudienceEnabled: taskConfig.targetAudienceEnabled,
            rewritePlanEnabled: taskConfig.rewritePlanEnabled,
          },
        },
        tx,
      );

      createdTaskKeys.push({
        key: createdTask.key,
        rewritePlanEnabled: taskConfig.rewritePlanEnabled,
        prompt: taskConfig.prompt.content,
      });
    }

    const rewritePlanTasks = Object.fromEntries(
      createdTaskKeys.map((task) => [task.key, task.rewritePlanEnabled]),
    );
    await tx.globalConfig.update({
      where: { configKey: GLOBAL_CONFIG_KEY },
      data: {
        rewritePlanTasks,
        updatedBy: actor,
      },
    });

    const promptEntries: Array<{ name: string; content: string }> = [
      ...config.settings.systemPrompts.map((prompt) => ({
        name: prompt.name,
        content: prompt.content,
      })),
      ...config.settings.targetAudiences.map((audience) => ({
        name: `${TARGET_AUDIENCE_PREFIX}${audience.label}`,
        content: audience.prompt.content,
      })),
      ...createdTaskKeys.map((task) => ({
        name: `${TASK_PROMPT_PREFIX}${task.key}`,
        content: task.prompt,
      })),
    ];

    await tx.promptTemplate.createMany({
      data: promptEntries.map((entry) => ({
        name: entry.name,
        content: entry.content,
        version: 1,
        isActive: true,
        updatedBy: actor,
      })),
    });

    if (config.settings.ordlista.length > 0) {
      await tx.ordlistaEntry.createMany({
        data: config.settings.ordlista.map((entry) => ({
          fromWord: entry.fromWord,
          toWord: entry.toWord,
          updatedBy: actor,
        })),
      });
    }

    const catalog: TargetAudienceCatalog = {
      categories: [...config.settings.targetAudienceCategories],
      audiences: config.settings.targetAudiences.map((audience) => ({
        label: audience.label,
        category: audience.category,
        sortOrder: audience.sortOrder,
      })),
    };
    await saveTargetAudienceCatalog(catalog, actor, tx);
  });

  const promptsCreated =
    config.settings.systemPrompts.length +
    config.settings.targetAudiences.length +
    createdTaskKeys.length;

  return {
    applied: true,
    reason: "applied",
    promptsCreated,
    tasksCreated: createdTaskKeys.length,
    ordlistaCreated: config.settings.ordlista.length,
  };
}
