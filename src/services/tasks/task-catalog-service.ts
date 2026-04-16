import { getPrismaClient } from "../../config/database/prisma-client.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  validateAndNormalizeTaskSettings,
  type TaskOutputMode,
  type TaskSettings,
} from "../../config/tasks/task-contract.js";

const TASK_KEY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9:-]*[A-Za-z0-9])?$/;
const TASK_KEY_MAX_LENGTH = 80;
const TASK_LABEL_MAX_LENGTH = 120;
const TASK_DESCRIPTION_MAX_LENGTH = 500;
const SORT_ORDER_STEP = 10;

type TaskCatalogDbClient = Prisma.TransactionClient | PrismaClient;

export interface TaskDefinitionRecord {
  id: number;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
  outputMode: TaskOutputMode;
  bulletCount: number | null;
  maxChars: number | null;
  targetAudienceEnabled: boolean;
  rewritePlanEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListTaskDefinitionsOptions {
  enabledOnly?: boolean;
}

export interface CreateTaskDefinitionInput {
  label: string;
  description?: string | null;
  enabled?: boolean;
  sortOrder?: number;
  settings?: Partial<TaskSettings>;
}

export interface UpdateTaskDefinitionInput {
  label?: string;
  description?: string | null;
  enabled?: boolean;
  sortOrder?: number;
  settings?: Partial<TaskSettings>;
}

export interface TaskKeyValidationResult {
  valid: boolean;
  key: string;
  error?: string;
}

function toTaskDefinitionRecord(task: {
  id: number;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
  outputMode: string;
  bulletCount: number | null;
  maxChars: number | null;
  targetAudienceEnabled: boolean;
  rewritePlanEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TaskDefinitionRecord {
  return {
    id: task.id,
    key: task.key,
    label: task.label,
    description: task.description,
    enabled: task.enabled,
    sortOrder: task.sortOrder,
    outputMode: task.outputMode as TaskOutputMode,
    bulletCount: task.bulletCount,
    maxChars: task.maxChars,
    targetAudienceEnabled: task.targetAudienceEnabled,
    rewritePlanEnabled: task.rewritePlanEnabled,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function validateTaskKey(value: unknown): TaskKeyValidationResult {
  if (typeof value !== "string") {
    return {
      valid: false,
      key: "",
      error: "task key must be a string",
    };
  }

  const normalizedKey = value.trim();
  if (normalizedKey.length === 0) {
    return {
      valid: false,
      key: normalizedKey,
      error: "task key cannot be empty",
    };
  }

  if (normalizedKey.length > TASK_KEY_MAX_LENGTH) {
    return {
      valid: false,
      key: normalizedKey,
      error: `task key cannot exceed ${TASK_KEY_MAX_LENGTH} characters`,
    };
  }

  if (!TASK_KEY_PATTERN.test(normalizedKey)) {
    return {
      valid: false,
      key: normalizedKey,
      error:
        "task key can only contain letters, numbers, colon, and hyphen, and must start/end with letter or number",
    };
  }

  return {
    valid: true,
    key: normalizedKey,
  };
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > TASK_LABEL_MAX_LENGTH) {
    return null;
  }

  return normalized;
}

export function buildTaskKeyBaseFromLabel(label: string): string {
  const normalized = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    return "task";
  }

  return normalized.slice(0, TASK_KEY_MAX_LENGTH);
}

export function buildUniqueTaskKeysFromLabels(labels: string[]): string[] {
  const used = new Set<string>();

  return labels.map((label) => {
    const baseKey = buildTaskKeyBaseFromLabel(label);
    let candidate = baseKey;
    let suffix = 2;

    while (used.has(candidate)) {
      const suffixText = `-${suffix}`;
      const truncatedBase = baseKey.slice(
        0,
        Math.max(1, TASK_KEY_MAX_LENGTH - suffixText.length),
      );
      candidate = `${truncatedBase}${suffixText}`;
      suffix += 1;
    }

    used.add(candidate);
    return candidate;
  });
}

async function generateUniqueTaskKeyFromLabel(
  label: string,
  prisma: TaskCatalogDbClient,
): Promise<string> {
  const baseKey = buildTaskKeyBaseFromLabel(label);
  let candidate = baseKey;
  let suffix = 2;

  while (true) {
    const existing = await prisma.taskDefinition.findUnique({
      where: { key: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    const suffixText = `-${suffix}`;
    const truncatedBase = baseKey.slice(
      0,
      Math.max(1, TASK_KEY_MAX_LENGTH - suffixText.length),
    );
    candidate = `${truncatedBase}${suffixText}`;
    suffix += 1;
  }
}

function normalizeDescription(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized.slice(0, TASK_DESCRIPTION_MAX_LENGTH);
}

function normalizeSortOrder(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  return null;
}

async function getNextSortOrder(prisma: TaskCatalogDbClient): Promise<number> {
  const aggregate = await prisma.taskDefinition.aggregate({
    _max: { sortOrder: true },
  });

  return (aggregate._max.sortOrder ?? 0) + SORT_ORDER_STEP;
}

export function buildReorderedTaskKeys(
  currentKeys: string[],
  prioritizedKeys: string[],
): string[] {
  const currentSet = new Set(currentKeys);
  const seen = new Set<string>();
  const normalizedPrioritized: string[] = [];

  for (const key of prioritizedKeys) {
    if (!currentSet.has(key)) {
      throw new Error(`Unknown task key in reorder payload: ${key}`);
    }
    if (seen.has(key)) {
      throw new Error(`Duplicate task key in reorder payload: ${key}`);
    }

    seen.add(key);
    normalizedPrioritized.push(key);
  }

  const trailingKeys = currentKeys.filter((key) => !seen.has(key));
  return [...normalizedPrioritized, ...trailingKeys];
}

export async function listTaskDefinitions(
  options: ListTaskDefinitionsOptions = {},
): Promise<TaskDefinitionRecord[]> {
  const prisma = getPrismaClient();
  const tasks = await prisma.taskDefinition.findMany({
    where: options.enabledOnly ? { enabled: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return tasks.map(toTaskDefinitionRecord);
}

export async function getTaskDefinitionByKey(
  taskKey: string,
): Promise<TaskDefinitionRecord | null> {
  const keyValidation = validateTaskKey(taskKey);
  if (!keyValidation.valid) {
    return null;
  }

  const prisma = getPrismaClient();
  const task = await prisma.taskDefinition.findUnique({
    where: { key: keyValidation.key },
  });

  if (!task) {
    return null;
  }

  return toTaskDefinitionRecord(task);
}

export async function createTaskDefinition(
  input: CreateTaskDefinitionInput,
  dbClient?: TaskCatalogDbClient,
): Promise<TaskDefinitionRecord> {
  const label = normalizeLabel(input.label);
  if (!label) {
    throw new Error("Task label is required and must be 1-120 characters");
  }

  const settingsValidation = validateAndNormalizeTaskSettings(input.settings || {});
  if (!settingsValidation.valid) {
    throw new Error(settingsValidation.errors.join("; "));
  }

  const prisma = dbClient ?? getPrismaClient();
  const generatedKey = await generateUniqueTaskKeyFromLabel(label, prisma);

  const sortOrder =
    normalizeSortOrder(input.sortOrder) ?? (await getNextSortOrder(prisma));

  const task = await prisma.taskDefinition.create({
    data: {
      key: generatedKey,
      label,
      description: normalizeDescription(input.description),
      enabled: input.enabled ?? true,
      sortOrder,
      outputMode: settingsValidation.settings.outputMode,
      bulletCount: settingsValidation.settings.bulletCount,
      maxChars: settingsValidation.settings.maxChars,
      targetAudienceEnabled: settingsValidation.settings.targetAudienceEnabled,
      rewritePlanEnabled: settingsValidation.settings.rewritePlanEnabled,
    },
  });

  return toTaskDefinitionRecord(task);
}

export async function updateTaskDefinition(
  taskKey: string,
  input: UpdateTaskDefinitionInput,
): Promise<TaskDefinitionRecord> {
  const keyValidation = validateTaskKey(taskKey);
  if (!keyValidation.valid) {
    throw new Error(keyValidation.error || "Invalid task key");
  }

  const prisma = getPrismaClient();
  const existing = await prisma.taskDefinition.findUnique({
    where: { key: keyValidation.key },
  });
  if (!existing) {
    throw new Error(`Task not found: ${keyValidation.key}`);
  }

  const currentSettings: TaskSettings = {
    outputMode: existing.outputMode as TaskOutputMode,
    bulletCount: existing.bulletCount,
    maxChars: existing.maxChars,
    targetAudienceEnabled: existing.targetAudienceEnabled,
    rewritePlanEnabled: existing.rewritePlanEnabled,
  };

  const mergedSettings = {
    ...currentSettings,
    ...(input.settings || {}),
  };
  const settingsValidation = validateAndNormalizeTaskSettings(mergedSettings);
  if (!settingsValidation.valid) {
    throw new Error(settingsValidation.errors.join("; "));
  }

  const data: {
    label?: string;
    description?: string | null;
    enabled?: boolean;
    sortOrder?: number;
    outputMode: TaskOutputMode;
    bulletCount: number | null;
    maxChars: number | null;
    targetAudienceEnabled: boolean;
    rewritePlanEnabled: boolean;
  } = {
    outputMode: settingsValidation.settings.outputMode,
    bulletCount: settingsValidation.settings.bulletCount,
    maxChars: settingsValidation.settings.maxChars,
    targetAudienceEnabled: settingsValidation.settings.targetAudienceEnabled,
    rewritePlanEnabled: settingsValidation.settings.rewritePlanEnabled,
  };

  if (input.label !== undefined) {
    const normalizedLabel = normalizeLabel(input.label);
    if (!normalizedLabel) {
      throw new Error("Task label must be 1-120 characters");
    }
    data.label = normalizedLabel;
  }

  if (input.description !== undefined) {
    data.description = normalizeDescription(input.description);
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      throw new Error("enabled must be boolean");
    }
    data.enabled = input.enabled;
  }

  if (input.sortOrder !== undefined) {
    const sortOrder = normalizeSortOrder(input.sortOrder);
    if (!sortOrder) {
      throw new Error("sortOrder must be a positive integer");
    }
    data.sortOrder = sortOrder;
  }

  const task = await prisma.taskDefinition.update({
    where: { key: keyValidation.key },
    data,
  });

  return toTaskDefinitionRecord(task);
}

export async function deleteTaskDefinition(taskKey: string): Promise<void> {
  const keyValidation = validateTaskKey(taskKey);
  if (!keyValidation.valid) {
    throw new Error(keyValidation.error || "Invalid task key");
  }

  const prisma = getPrismaClient();
  await prisma.taskDefinition.delete({ where: { key: keyValidation.key } });
}

export async function reorderTaskDefinitions(
  prioritizedTaskKeys: string[],
): Promise<TaskDefinitionRecord[]> {
  if (!Array.isArray(prioritizedTaskKeys)) {
    throw new Error("Task reorder payload must be an array");
  }

  const normalizedKeys = prioritizedTaskKeys.map((key) => {
    const keyValidation = validateTaskKey(key);
    if (!keyValidation.valid) {
      throw new Error(keyValidation.error || "Invalid task key");
    }
    return keyValidation.key;
  });

  const currentTasks = await listTaskDefinitions();
  const currentKeys = currentTasks.map((task) => task.key);
  const reorderedKeys = buildReorderedTaskKeys(currentKeys, normalizedKeys);

  const prisma = getPrismaClient();
  await prisma.$transaction(
    reorderedKeys.map((key, index) =>
      prisma.taskDefinition.update({
        where: { key },
        data: { sortOrder: (index + 1) * SORT_ORDER_STEP },
      }),
    ),
  );

  return listTaskDefinitions();
}
