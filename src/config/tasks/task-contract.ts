/**
 * Task contract for dynamic task catalog v1.
 *
 * This module locks:
 * 1) the allowed task behavior settings
 */

export type TaskWebSearchMode = "inherit" | "off" | "on";
export const TASK_WEB_SEARCH_MODES: readonly TaskWebSearchMode[] = ["inherit", "off", "on"];

export interface TaskSettings {
  targetAudienceEnabled: boolean;
  rewritePlanEnabled: boolean;
  reasoningEnabled: boolean;
  webSearchMode: TaskWebSearchMode;
}

export interface TaskSettingsValidationResult {
  valid: boolean;
  errors: string[];
  settings: TaskSettings;
}

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  targetAudienceEnabled: true,
  rewritePlanEnabled: true,
  reasoningEnabled: true,
  webSearchMode: "inherit",
};

function parseBoolean(value: unknown): boolean | "invalid" {
  if (typeof value === "boolean") {
    return value;
  }

  return "invalid";
}

export function validateAndNormalizeTaskSettings(input: {
  targetAudienceEnabled?: unknown;
  rewritePlanEnabled?: unknown;
  reasoningEnabled?: unknown;
  webSearchMode?: unknown;
}): TaskSettingsValidationResult {
  const errors: string[] = [];
  const settings: TaskSettings = { ...DEFAULT_TASK_SETTINGS };

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

  if (input.reasoningEnabled !== undefined) {
    const parsed = parseBoolean(input.reasoningEnabled);
    if (parsed === "invalid") {
      errors.push("reasoningEnabled must be boolean");
    } else {
      settings.reasoningEnabled = parsed;
    }
  }

  if (input.webSearchMode !== undefined) {
    if (typeof input.webSearchMode === "string" && TASK_WEB_SEARCH_MODES.includes(input.webSearchMode as TaskWebSearchMode)) {
      settings.webSearchMode = input.webSearchMode as TaskWebSearchMode;
    } else {
      errors.push("webSearchMode must be one of inherit, off, on");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    settings,
  };
}
