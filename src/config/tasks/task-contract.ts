/**
 * Task contract for dynamic task catalog v1.
 *
 * This module locks:
 * 1) the allowed task behavior settings
 */

export type TaskOutputMode = "rewrite" | "summary" | "bullets";

export interface TaskSettings {
  outputMode: TaskOutputMode;
  bulletCount: number | null;
  maxChars: number | null;
  targetAudienceEnabled: boolean;
  rewritePlanEnabled: boolean;
}

export interface TaskSettingsValidationResult {
  valid: boolean;
  errors: string[];
  settings: TaskSettings;
}

export const TASK_OUTPUT_MODES: readonly TaskOutputMode[] = [
  "rewrite",
  "summary",
  "bullets",
];

export const TASK_CONTRACT_LIMITS = {
  minBulletCount: 1,
  maxBulletCount: 20,
  minMaxChars: 100,
  maxMaxChars: 50000,
} as const;

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  outputMode: "rewrite",
  bulletCount: null,
  maxChars: null,
  targetAudienceEnabled: true,
  rewritePlanEnabled: true,
};

function parseOptionalInteger(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value : "invalid";
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed.toString() === value.trim()
      ? parsed
      : "invalid";
  }

  return "invalid";
}

function parseBoolean(value: unknown): boolean | "invalid" {
  if (typeof value === "boolean") {
    return value;
  }

  return "invalid";
}

export function validateAndNormalizeTaskSettings(input: {
  outputMode?: unknown;
  bulletCount?: unknown;
  maxChars?: unknown;
  targetAudienceEnabled?: unknown;
  rewritePlanEnabled?: unknown;
}): TaskSettingsValidationResult {
  const errors: string[] = [];
  const settings: TaskSettings = { ...DEFAULT_TASK_SETTINGS };

  if (input.outputMode !== undefined) {
    if (
      typeof input.outputMode === "string" &&
      TASK_OUTPUT_MODES.includes(input.outputMode as TaskOutputMode)
    ) {
      settings.outputMode = input.outputMode as TaskOutputMode;
    } else {
      errors.push("outputMode must be one of rewrite, summary, bullets");
    }
  }

  if (input.bulletCount !== undefined) {
    const bulletCount = parseOptionalInteger(input.bulletCount);
    if (bulletCount === "invalid") {
      errors.push("bulletCount must be an integer");
    } else {
      settings.bulletCount = bulletCount;
    }
  }

  if (input.maxChars !== undefined) {
    const maxChars = parseOptionalInteger(input.maxChars);
    if (maxChars === "invalid") {
      errors.push("maxChars must be an integer");
    } else {
      settings.maxChars = maxChars;
    }
  }

  if (input.targetAudienceEnabled !== undefined) {
    const parsed = parseBoolean(input.targetAudienceEnabled);
    if (parsed === "invalid") {
      errors.push("targetAudienceEnabled must be boolean");
    } else {
      settings.targetAudienceEnabled = parsed;
    }
  }

  if (input.rewritePlanEnabled !== undefined) {
    const parsed = parseBoolean(input.rewritePlanEnabled);
    if (parsed === "invalid") {
      errors.push("rewritePlanEnabled must be boolean");
    } else {
      settings.rewritePlanEnabled = parsed;
    }
  }

  if (settings.outputMode === "bullets") {
    if (settings.bulletCount === null) {
      errors.push("bulletCount is required when outputMode is bullets");
    }
  } else if (settings.bulletCount !== null) {
    errors.push("bulletCount is only allowed when outputMode is bullets");
    settings.bulletCount = null;
  }

  if (settings.bulletCount !== null) {
    if (
      settings.bulletCount < TASK_CONTRACT_LIMITS.minBulletCount ||
      settings.bulletCount > TASK_CONTRACT_LIMITS.maxBulletCount
    ) {
      errors.push(
        `bulletCount must be between ${TASK_CONTRACT_LIMITS.minBulletCount} and ${TASK_CONTRACT_LIMITS.maxBulletCount}`,
      );
    }
  }

  if (settings.maxChars !== null) {
    if (
      settings.maxChars < TASK_CONTRACT_LIMITS.minMaxChars ||
      settings.maxChars > TASK_CONTRACT_LIMITS.maxMaxChars
    ) {
      errors.push(
        `maxChars must be between ${TASK_CONTRACT_LIMITS.minMaxChars} and ${TASK_CONTRACT_LIMITS.maxMaxChars}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    settings,
  };
}
