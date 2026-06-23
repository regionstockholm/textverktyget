/**
 * Task contract for dynamic task catalog v1.
 *
 * This module locks:
 * 1) the allowed task behavior settings
 */

export type TaskOutputMode = "rewrite" | "summary" | "bullets";

export interface TaskSettings {
  outputMode: TaskOutputMode;
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

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  outputMode: "rewrite",
  targetAudienceEnabled: true,
  rewritePlanEnabled: true,
};

function parseBoolean(value: unknown): boolean | "invalid" {
  if (typeof value === "boolean") {
    return value;
  }

  return "invalid";
}

export function validateAndNormalizeTaskSettings(input: {
  outputMode?: unknown;
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

  return {
    valid: errors.length === 0,
    errors,
    settings,
  };
}
