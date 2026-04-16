import { getPrismaClient } from "../../config/database/prisma-client.js";
import { getDefaultPrompts } from "../../prompts/default-prompts-loader.js";
import {
  buildTaskKeyBaseFromLabel,
  listTaskDefinitions,
  type TaskDefinitionRecord,
} from "./task-catalog-service.js";

const TASK_PROMPT_PREFIX = "task:";

export function buildDefaultTaskPromptContent(task: TaskDefinitionRecord): string {
  const prompts = getDefaultPrompts().task;
  const taskKey = task.key.trim();
  const generatedKeyFromLabel = buildTaskKeyBaseFromLabel(task.label);

  if (typeof prompts[taskKey] === "string" && prompts[taskKey].trim().length > 0) {
    return prompts[taskKey];
  }

  if (
    typeof prompts[generatedKeyFromLabel] === "string" &&
    prompts[generatedKeyFromLabel].trim().length > 0
  ) {
    return prompts[generatedKeyFromLabel];
  }

  const fallbackPrompt = Object.values(prompts).find(
    (prompt) => typeof prompt === "string" && prompt.trim().length > 0,
  );
  if (!fallbackPrompt) {
    throw new Error("Missing default task prompt.");
  }

  return fallbackPrompt;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "P2002";
}

export async function ensureTaskPromptDefaults(
  actor: string = "system",
): Promise<{ checked: number; created: number }> {
  const tasks = await listTaskDefinitions();
  if (tasks.length === 0) {
    return { checked: 0, created: 0 };
  }

  const prisma = getPrismaClient();
  const promptNames = tasks.map((task) => `${TASK_PROMPT_PREFIX}${task.key}`);
  const activePrompts = await prisma.promptTemplate.findMany({
    where: {
      name: { in: promptNames },
      isActive: true,
    },
    select: { name: true },
  });

  const activePromptNames = new Set(activePrompts.map((prompt) => prompt.name));
  let created = 0;

  for (const task of tasks) {
    const promptName = `${TASK_PROMPT_PREFIX}${task.key}`;
    if (activePromptNames.has(promptName)) {
      continue;
    }

    const fallbackContent = buildDefaultTaskPromptContent(task);
    const latestPrompt = await prisma.promptTemplate.findFirst({
      where: { name: promptName },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latestPrompt?.version ?? 0) + 1;

    try {
      await prisma.promptTemplate.create({
        data: {
          name: promptName,
          content: fallbackContent,
          version: nextVersion,
          isActive: true,
          updatedBy: actor,
        },
      });
      created += 1;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  return {
    checked: tasks.length,
    created,
  };
}
