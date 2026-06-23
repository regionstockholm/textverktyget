import { readIntegerEnv } from "./read-env.js";

export type QualityControlConfig = {
  maxScore: number;
  minScore: number;
  maxAttempts: number;
  safePurgeHours: number;
  purgeIntervalMinutes: number;
};

export const qualityControlConfig: QualityControlConfig = {
  maxScore: readIntegerEnv("QUALITY_MAX_SCORE", 10, 1, 10),
  minScore: readIntegerEnv("QUALITY_MIN_SCORE", 1, 1, 10),
  maxAttempts: readIntegerEnv("QUALITY_MAX_ATTEMPTS", 5, 1, 20),
  safePurgeHours: readIntegerEnv("QUALITY_PURGE_HOURS", 6, 1, 24 * 30),
  purgeIntervalMinutes: readIntegerEnv(
    "QUALITY_PURGE_INTERVAL_MINUTES",
    1440,
    1,
    24 * 60,
  ),
};
