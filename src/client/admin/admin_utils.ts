import { DEFAULT_GEMINI_QE_TEMPERATURE } from "./admin_constants.js";
import type {
  RewritePlanTaskSettings,
  RuntimeSettings,
} from "./admin_types.js";

export function resolveRewritePlanTasks(
  value: unknown,
): RewritePlanTaskSettings {
  const result: RewritePlanTaskSettings = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }

  Object.entries(value as Record<string, unknown>).forEach(
    ([key, candidate]) => {
      if (typeof candidate === "boolean") {
        result[key] = candidate;
      }
    },
  );

  return result;
}

export function resolveRuntimeSettings(value: unknown): RuntimeSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as RuntimeSettings;
}

export function readRuntimeQualityTemperature(
  runtimeSettings: RuntimeSettings,
): number {
  const qualitySettings = readRecord(runtimeSettings.quality);
  const candidate = qualitySettings.temperature;
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return Math.min(1, Math.max(0, candidate));
  }

  return DEFAULT_GEMINI_QE_TEMPERATURE;
}

export function readRuntimeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseIntegerField(
  input: HTMLInputElement,
  label: string,
  min: number,
  max: number,
): number {
  const raw = input.value.trim();
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} måste vara ett heltal mellan ${min} och ${max}.`);
  }

  return value;
}

export function cloneRuntimeSettings(settings: RuntimeSettings): RuntimeSettings {
  return JSON.parse(JSON.stringify(settings || {})) as RuntimeSettings;
}

export function getRuntimeObject(
  parent: RuntimeSettings,
  key: string,
): Record<string, unknown> {
  const existing = parent[key];
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }

  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

export function readRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function normalizeTaskIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
