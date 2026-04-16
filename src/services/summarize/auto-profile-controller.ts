import { createClient } from "redis";
import type { Prisma } from "@prisma/client";
import { config } from "../../config/app-config.js";
import { getPrismaClient } from "../../config/database/prisma-client.js";
import { AI_PROVIDERS } from "../../config/ai/ai-config.js";
import configService from "../config/config-service.js";
import { logger } from "../../utils/logger.js";
import { getSummarizeQueueState } from "./summarize-queue.js";

export type AutoProfileName = "quality" | "balanced" | "stress";
export type AutoProfileMode = "auto" | "manual";

export interface AutoProfileThreshold {
  busyRate: number;
  queueUtil: number;
  p95Ms: number;
  transientRate: number;
}

export interface AutoProfileThresholds {
  toBalanced: AutoProfileThreshold;
  toStress: AutoProfileThreshold;
  toQuality: AutoProfileThreshold;
}

export interface AutoProfileWindows {
  escalateConsecutive: number;
  relaxConsecutive: number;
  minSamples: number;
}

export interface AutoProfileResolvedConfig {
  enabled: boolean;
  mode: AutoProfileMode;
  dryRun: boolean;
  currentProfile: AutoProfileName;
  manualProfile: AutoProfileName;
  evaluateEveryMs: number;
  windowMs: number;
  minDwellMs: number;
  cooldownMs: number;
  thresholds: AutoProfileThresholds;
  windows: AutoProfileWindows;
  profileSettings: Record<AutoProfileName, Record<string, unknown>>;
}

export interface AutoProfileControllerState {
  currentProfile: AutoProfileName;
  escalateStreak: number;
  relaxStreak: number;
  lastEvaluatedAtMs: number;
  lastTransitionAtMs: number;
  lastDecisionReason: string | null;
  lastTransitionMetrics: AutoProfileMetrics | null;
}

export interface AutoProfileMetrics {
  requestCount: number;
  successRate: number;
  busyRate: number;
  transientRate: number;
  p95Ms: number;
  queueUtilization: number;
  queueRunning: number;
  queueQueued: number;
}

interface SummarizeMetricSample {
  timestampMs: number;
  statusCode: number;
  latencyMs: number;
  transientFailure: boolean;
}

interface AutoProfileTransitionDecision {
  nextState: AutoProfileControllerState;
  transitionTo: AutoProfileName | null;
  reason: string | null;
}

const GROUP_ID = process.env.GROUP_ID?.trim() || "default";
const AUTO_PROFILE_REDIS_URL =
  process.env.AUTO_PROFILE_REDIS_URL?.trim() ||
  process.env.SUMMARIZE_QUEUE_REDIS_URL?.trim() ||
  process.env.RATE_LIMIT_REDIS_URL?.trim() ||
  process.env.REDIS_URL?.trim() ||
  "";
const AUTO_PROFILE_LOCK_KEY_PREFIX =
  process.env.AUTO_PROFILE_LOCK_KEY_PREFIX?.trim() || "textverktyg:auto_profile";
const AUTO_PROFILE_LOCK_TTL_MS = readIntegerEnv(
  process.env.AUTO_PROFILE_LOCK_TTL_MS,
  45000,
  5000,
  300000,
);
const AUTO_PROFILE_ACTOR = "auto-profile-controller";
const EVALUATOR_TICK_MS = 5000;
const MAX_METRIC_SAMPLES = 5000;

const ACQUIRE_LEADER_LOCK_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]
local ttl = tonumber(ARGV[2])

local current = redis.call('GET', key)
if not current then
  redis.call('SET', key, token, 'PX', ttl)
  return 1
end

if current == token then
  redis.call('PEXPIRE', key, ttl)
  return 1
end

return 0
`;

const RELEASE_LEADER_LOCK_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]

local current = redis.call('GET', key)
if current == token then
  return redis.call('DEL', key)
end

return 0
`;

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<RedisClient | null> | null = null;
let redisUnavailableLogged = false;
const leaderToken = `${GROUP_ID}:${process.pid}:${Math.random().toString(36).slice(2, 10)}`;

const metricSamples: SummarizeMetricSample[] = [];

let controllerInterval: NodeJS.Timeout | null = null;
let evaluateInFlight = false;
let autoProfileLeader = false;
let lastResolvedConfig: AutoProfileResolvedConfig | null = null;
let state: AutoProfileControllerState = createAutoProfileControllerState("quality");

function readIntegerEnv(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(value, min, max);
}

function readInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(Math.trunc(value), min, max);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "boolean") {
    return fallback;
  }

  return value;
}

function readProfile(value: unknown, fallback: AutoProfileName): AutoProfileName {
  if (value === "quality" || value === "balanced" || value === "stress") {
    return value;
  }

  return fallback;
}

function readMode(value: unknown, fallback: AutoProfileMode): AutoProfileMode {
  if (value === "manual" || value === "auto") {
    return value;
  }

  return fallback;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(value) && isRecord(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
      continue;
    }

    if (isRecord(value)) {
      result[key] = deepMerge({}, value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  const selected = sorted[index];
  return typeof selected === "number" ? selected : 0;
}

function getDefaultProfileSettings(): Record<AutoProfileName, Record<string, unknown>> {
  const queueDefaults = config.performance.summarizeQueue;

  return {
    quality: {
      quality: { enabled: true },
      repair: {
        enabled: true,
        maxAttempts: 2,
        minScore: 8,
        minSubscore: 8,
        maxActionsPerAttempt: 2,
      },
      retry: {
        qualityMaxAttempts: config.qualityControl.maxAttempts,
        providerMaxRetries: 3,
      },
      summarizeQueue: {
        maxConcurrentJobs: queueDefaults.maxConcurrentJobs,
        maxQueueSize: queueDefaults.maxQueueSize,
        maxWaitMs: queueDefaults.maxWaitMs,
        retryAfterSeconds: queueDefaults.retryAfterSeconds,
      },
      stageConcurrency: {
        analysis: 32,
        rewrite: queueDefaults.maxConcurrentJobs,
        critic: 16,
      },
    },
    balanced: {
      quality: { enabled: true },
      repair: {
        enabled: false,
        maxAttempts: 0,
        minScore: 8,
        minSubscore: 8,
        maxActionsPerAttempt: 2,
      },
      retry: {
        qualityMaxAttempts: 1,
        providerMaxRetries: 2,
      },
      summarizeQueue: {
        maxConcurrentJobs: Math.max(queueDefaults.maxConcurrentJobs, 20),
        maxQueueSize: Math.max(queueDefaults.maxQueueSize, 300),
        maxWaitMs: Math.max(queueDefaults.maxWaitMs, 180000),
        retryAfterSeconds: Math.min(queueDefaults.retryAfterSeconds, 10),
      },
      stageConcurrency: {
        analysis: 20,
        rewrite: 20,
        critic: 10,
      },
    },
    stress: {
      quality: { enabled: true },
      repair: {
        enabled: false,
        maxAttempts: 0,
        minScore: 8,
        minSubscore: 8,
        maxActionsPerAttempt: 2,
      },
      retry: {
        qualityMaxAttempts: 1,
        providerMaxRetries: 3,
      },
      summarizeQueue: {
        maxConcurrentJobs: 50,
        maxQueueSize: 600,
        maxWaitMs: 600000,
        retryAfterSeconds: 5,
      },
      stageConcurrency: {
        analysis: 50,
        rewrite: 50,
        critic: 50,
      },
    },
  };
}

function getDefaultThresholds(): AutoProfileThresholds {
  return {
    toBalanced: {
      busyRate: 0.05,
      queueUtil: 0.6,
      p95Ms: 18000,
      transientRate: 0.05,
    },
    toStress: {
      busyRate: 0.15,
      queueUtil: 0.8,
      p95Ms: 30000,
      transientRate: 0.12,
    },
    toQuality: {
      busyRate: 0.02,
      queueUtil: 0.3,
      p95Ms: 12000,
      transientRate: 0.02,
    },
  };
}

export function createAutoProfileControllerState(
  currentProfile: AutoProfileName,
): AutoProfileControllerState {
  return {
    currentProfile,
    escalateStreak: 0,
    relaxStreak: 0,
    lastEvaluatedAtMs: 0,
    lastTransitionAtMs: 0,
    lastDecisionReason: null,
    lastTransitionMetrics: null,
  };
}

export function resolveAutoProfileConfig(
  runtimeSettings: unknown,
): AutoProfileResolvedConfig {
  const root = isRecord(runtimeSettings) ? runtimeSettings : {};
  const autoProfile = isRecord(root.autoProfile) ? root.autoProfile : {};
  const thresholds = isRecord(autoProfile.thresholds) ? autoProfile.thresholds : {};
  const toBalanced = isRecord(thresholds.toBalanced) ? thresholds.toBalanced : {};
  const toStress = isRecord(thresholds.toStress) ? thresholds.toStress : {};
  const toQuality = isRecord(thresholds.toQuality) ? thresholds.toQuality : {};
  const windows = isRecord(autoProfile.windows) ? autoProfile.windows : {};

  const defaultProfileSettings = getDefaultProfileSettings();
  const profileSettingsRaw = isRecord(autoProfile.profileSettings)
    ? autoProfile.profileSettings
    : {};

  const profileSettings: Record<AutoProfileName, Record<string, unknown>> = {
    quality: deepMerge(
      defaultProfileSettings.quality,
      isRecord(profileSettingsRaw.quality)
        ? (profileSettingsRaw.quality as Record<string, unknown>)
        : {},
    ),
    balanced: deepMerge(
      defaultProfileSettings.balanced,
      isRecord(profileSettingsRaw.balanced)
        ? (profileSettingsRaw.balanced as Record<string, unknown>)
        : {},
    ),
    stress: deepMerge(
      defaultProfileSettings.stress,
      isRecord(profileSettingsRaw.stress)
        ? (profileSettingsRaw.stress as Record<string, unknown>)
        : {},
    ),
  };

  const defaultThresholds = getDefaultThresholds();

  return {
    enabled: readBoolean(autoProfile.enabled, false),
    mode: readMode(autoProfile.mode, "auto"),
    dryRun: readBoolean(autoProfile.dryRun, false),
    currentProfile: readProfile(autoProfile.currentProfile, "quality"),
    manualProfile: readProfile(autoProfile.manualProfile, "quality"),
    evaluateEveryMs: readInteger(
      autoProfile.evaluateEverySeconds,
      15,
      5,
      300,
    ) * 1000,
    windowMs: readInteger(autoProfile.windowSeconds, 60, 10, 900) * 1000,
    minDwellMs: readInteger(autoProfile.minDwellSeconds, 300, 0, 3600) * 1000,
    cooldownMs: readInteger(autoProfile.cooldownSeconds, 120, 0, 3600) * 1000,
    thresholds: {
      toBalanced: {
        busyRate: readNumber(
          toBalanced.busyRate,
          defaultThresholds.toBalanced.busyRate,
          0,
          1,
        ),
        queueUtil: readNumber(
          toBalanced.queueUtil,
          defaultThresholds.toBalanced.queueUtil,
          0,
          1,
        ),
        p95Ms: readInteger(
          toBalanced.p95Ms,
          defaultThresholds.toBalanced.p95Ms,
          100,
          600000,
        ),
        transientRate: readNumber(
          toBalanced.transientRate,
          defaultThresholds.toBalanced.transientRate,
          0,
          1,
        ),
      },
      toStress: {
        busyRate: readNumber(
          toStress.busyRate,
          defaultThresholds.toStress.busyRate,
          0,
          1,
        ),
        queueUtil: readNumber(
          toStress.queueUtil,
          defaultThresholds.toStress.queueUtil,
          0,
          1,
        ),
        p95Ms: readInteger(
          toStress.p95Ms,
          defaultThresholds.toStress.p95Ms,
          100,
          600000,
        ),
        transientRate: readNumber(
          toStress.transientRate,
          defaultThresholds.toStress.transientRate,
          0,
          1,
        ),
      },
      toQuality: {
        busyRate: readNumber(
          toQuality.busyRate,
          defaultThresholds.toQuality.busyRate,
          0,
          1,
        ),
        queueUtil: readNumber(
          toQuality.queueUtil,
          defaultThresholds.toQuality.queueUtil,
          0,
          1,
        ),
        p95Ms: readInteger(
          toQuality.p95Ms,
          defaultThresholds.toQuality.p95Ms,
          100,
          600000,
        ),
        transientRate: readNumber(
          toQuality.transientRate,
          defaultThresholds.toQuality.transientRate,
          0,
          1,
        ),
      },
    },
    windows: {
      escalateConsecutive: readInteger(windows.escalateConsecutive, 2, 1, 20),
      relaxConsecutive: readInteger(windows.relaxConsecutive, 8, 1, 50),
      minSamples: readInteger(windows.minSamples, 20, 1, 5000),
    },
    profileSettings,
  };
}

function meetsEscalationThreshold(
  metrics: AutoProfileMetrics,
  threshold: AutoProfileThreshold,
): boolean {
  return (
    metrics.busyRate >= threshold.busyRate ||
    metrics.queueUtilization >= threshold.queueUtil ||
    metrics.p95Ms >= threshold.p95Ms ||
    metrics.transientRate >= threshold.transientRate
  );
}

function meetsStressEscalationThreshold(
  metrics: AutoProfileMetrics,
  threshold: AutoProfileThreshold,
): boolean {
  const busyExceeded = metrics.busyRate >= threshold.busyRate;
  const queueExceeded = metrics.queueUtilization >= threshold.queueUtil;
  const latencyExceeded = metrics.p95Ms >= threshold.p95Ms;
  const transientExceeded = metrics.transientRate >= threshold.transientRate;

  if (busyExceeded || queueExceeded) {
    return true;
  }

  return latencyExceeded && transientExceeded;
}

function meetsRecoveryThreshold(
  metrics: AutoProfileMetrics,
  threshold: AutoProfileThreshold,
): boolean {
  return (
    metrics.busyRate <= threshold.busyRate &&
    metrics.queueUtilization <= threshold.queueUtil &&
    metrics.p95Ms <= threshold.p95Ms &&
    metrics.transientRate <= threshold.transientRate
  );
}

export function evaluateAutoProfileTransition(
  currentState: AutoProfileControllerState,
  resolvedConfig: AutoProfileResolvedConfig,
  metrics: AutoProfileMetrics,
  nowMs: number,
): AutoProfileTransitionDecision {
  const nextState: AutoProfileControllerState = {
    ...currentState,
    lastEvaluatedAtMs: nowMs,
  };

  if (resolvedConfig.mode === "manual") {
    nextState.escalateStreak = 0;
    nextState.relaxStreak = 0;
    if (nextState.currentProfile !== resolvedConfig.manualProfile) {
      return {
        nextState,
        transitionTo: resolvedConfig.manualProfile,
        reason: "manual_override",
      };
    }

    return {
      nextState,
      transitionTo: null,
      reason: null,
    };
  }

  if (!resolvedConfig.enabled || metrics.requestCount < resolvedConfig.windows.minSamples) {
    nextState.escalateStreak = 0;
    nextState.relaxStreak = 0;
    return {
      nextState,
      transitionTo: null,
      reason: null,
    };
  }

  const elapsedSinceTransitionMs =
    nextState.lastTransitionAtMs > 0
      ? nowMs - nextState.lastTransitionAtMs
      : Number.POSITIVE_INFINITY;
  const relaxAllowed = elapsedSinceTransitionMs >= resolvedConfig.minDwellMs;

  const escalateBalanced = meetsEscalationThreshold(
    metrics,
    resolvedConfig.thresholds.toBalanced,
  );
  const escalateStress = meetsEscalationThreshold(
    metrics,
    resolvedConfig.thresholds.toStress,
  );
  const stressEscalationSignal = meetsStressEscalationThreshold(
    metrics,
    resolvedConfig.thresholds.toStress,
  );
  const recoverQuality = meetsRecoveryThreshold(
    metrics,
    resolvedConfig.thresholds.toQuality,
  );

  switch (nextState.currentProfile) {
    case "quality": {
      if (escalateBalanced) {
        nextState.escalateStreak += 1;
      } else {
        nextState.escalateStreak = 0;
      }
      nextState.relaxStreak = 0;

      if (nextState.escalateStreak >= resolvedConfig.windows.escalateConsecutive) {
        return {
          nextState,
          transitionTo: "balanced",
          reason: escalateStress ? "auto_escalate_stress_signal" : "auto_escalate_balanced_signal",
        };
      }

      return { nextState, transitionTo: null, reason: null };
    }
    case "balanced": {
      if (stressEscalationSignal) {
        nextState.escalateStreak += 1;
        nextState.relaxStreak = 0;
        if (nextState.escalateStreak >= resolvedConfig.windows.escalateConsecutive) {
          return {
            nextState,
            transitionTo: "stress",
            reason: "auto_escalate_stress_signal",
          };
        }
        return { nextState, transitionTo: null, reason: null };
      }

      nextState.escalateStreak = 0;

      if (recoverQuality && relaxAllowed) {
        nextState.relaxStreak += 1;
        if (nextState.relaxStreak >= resolvedConfig.windows.relaxConsecutive) {
          return {
            nextState,
            transitionTo: "quality",
            reason: "auto_recover_quality_signal",
          };
        }
        return { nextState, transitionTo: null, reason: null };
      }

      nextState.relaxStreak = 0;
      return { nextState, transitionTo: null, reason: null };
    }
    case "stress": {
      nextState.escalateStreak = 0;

      if (recoverQuality && relaxAllowed) {
        nextState.relaxStreak += 1;
        if (nextState.relaxStreak >= resolvedConfig.windows.relaxConsecutive) {
          return {
            nextState,
            transitionTo: "balanced",
            reason: "auto_recover_balanced_signal",
          };
        }
        return { nextState, transitionTo: null, reason: null };
      }

      nextState.relaxStreak = 0;
      return { nextState, transitionTo: null, reason: null };
    }
    default:
      return { nextState, transitionTo: null, reason: null };
  }
}

export function recordSummarizeRequestMetric(input: {
  statusCode: number;
  latencyMs: number;
  transientFailure?: boolean;
}): void {
  if (!Number.isInteger(input.statusCode) || input.statusCode < 100) {
    return;
  }

  const latency = Number.isFinite(input.latencyMs)
    ? Math.max(0, Math.trunc(input.latencyMs))
    : 0;
  const sample: SummarizeMetricSample = {
    timestampMs: Date.now(),
    statusCode: input.statusCode,
    latencyMs: latency,
    transientFailure: Boolean(input.transientFailure),
  };

  metricSamples.push(sample);
  if (metricSamples.length > MAX_METRIC_SAMPLES) {
    metricSamples.splice(0, metricSamples.length - MAX_METRIC_SAMPLES);
  }
}

export function computeAutoProfileMetrics(
  samples: SummarizeMetricSample[],
  nowMs: number,
  windowMs: number,
): AutoProfileMetrics {
  const cutoff = nowMs - windowMs;
  const activeSamples = samples.filter((sample) => sample.timestampMs >= cutoff);

  const requestCount = activeSamples.length;
  const successCount = activeSamples.filter((sample) => sample.statusCode === 200).length;
  const busyCount = activeSamples.filter(
    (sample) => sample.statusCode === 429 || sample.statusCode === 503,
  ).length;
  const transientCount = activeSamples.filter(
    (sample) => sample.transientFailure,
  ).length;
  const latencies = activeSamples.map((sample) => sample.latencyMs);
  const p95Ms = percentile(latencies, 95);

  const queueState = getSummarizeQueueState();
  const runningUtilization =
    queueState.maxConcurrentJobs > 0
      ? queueState.runningJobs / queueState.maxConcurrentJobs
      : 0;
  const queuedUtilization =
    queueState.maxQueueSize > 0 ? queueState.queuedJobs / queueState.maxQueueSize : 0;
  const queueUtilization = clamp(
    Math.max(runningUtilization, queuedUtilization),
    0,
    1,
  );

  return {
    requestCount,
    successRate: requestCount > 0 ? successCount / requestCount : 0,
    busyRate: requestCount > 0 ? busyCount / requestCount : 0,
    transientRate: requestCount > 0 ? transientCount / requestCount : 0,
    p95Ms,
    queueUtilization,
    queueRunning: queueState.runningJobs,
    queueQueued: queueState.queuedJobs,
  };
}

function shouldUseLeaderLock(): boolean {
  return config.features.sharedLimiter && AUTO_PROFILE_REDIS_URL.length > 0;
}

async function getRedisClient(): Promise<RedisClient | null> {
  if (!shouldUseLeaderLock()) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  redisConnectPromise = (async () => {
    try {
      const client = createClient({ url: AUTO_PROFILE_REDIS_URL });
      client.on("error", (error) => {
        logger.warn("auto_profile.redis.error", {
          processStatus: "running",
          meta: { reason: error.message },
        });
      });
      await client.connect();
      redisUnavailableLogged = false;
      redisClient = client;
      logger.info("auto_profile.redis.connected", {
        processStatus: "running",
        meta: { groupId: GROUP_ID },
      });
      return redisClient;
    } catch (error) {
      if (!redisUnavailableLogged) {
        logger.warn("auto_profile.redis.unavailable", {
          processStatus: "running",
          meta: {
            groupId: GROUP_ID,
            reason: error instanceof Error ? error.message : "unknown",
          },
        });
        redisUnavailableLogged = true;
      }

      redisClient = null;
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

function getLeaderLockKey(): string {
  return `${AUTO_PROFILE_LOCK_KEY_PREFIX}:${GROUP_ID}:leader`;
}

async function acquireLeaderLease(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return true;
  }

  try {
    const result = await client.eval(ACQUIRE_LEADER_LOCK_SCRIPT, {
      keys: [getLeaderLockKey()],
      arguments: [leaderToken, String(AUTO_PROFILE_LOCK_TTL_MS)],
    });
    return Number(result) === 1;
  } catch (error) {
    logger.warn("auto_profile.leader_lease_failed", {
      processStatus: "running",
      meta: {
        reason: error instanceof Error ? error.message : "unknown",
      },
    });
    return true;
  }
}

async function releaseLeaderLease(): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.eval(RELEASE_LEADER_LOCK_SCRIPT, {
      keys: [getLeaderLockKey()],
      arguments: [leaderToken],
    });
  } catch {
    // Ignore release failures during shutdown.
  }
}

function buildTransitionRuntimeSettings(
  currentRuntimeSettings: Record<string, unknown>,
  nextProfile: AutoProfileName,
  resolvedConfig: AutoProfileResolvedConfig,
  reason: string,
  metrics: AutoProfileMetrics,
): Record<string, unknown> {
  const merged = deepMerge(
    currentRuntimeSettings,
    resolvedConfig.profileSettings[nextProfile],
  );

  const autoProfileBase = isRecord(merged.autoProfile) ? merged.autoProfile : {};
  merged.autoProfile = {
    ...autoProfileBase,
    currentProfile: nextProfile,
    lastTransitionAt: new Date().toISOString(),
    lastTransitionReason: reason,
    lastTransitionMetrics: {
      requestCount: metrics.requestCount,
      busyRate: metrics.busyRate,
      p95Ms: metrics.p95Ms,
      queueUtilization: metrics.queueUtilization,
      transientRate: metrics.transientRate,
    },
  };

  return merged;
}

async function persistProfileTransition(
  nextProfile: AutoProfileName,
  resolvedConfig: AutoProfileResolvedConfig,
  reason: string,
  metrics: AutoProfileMetrics,
): Promise<void> {
  const prisma = getPrismaClient();
  const existing = await prisma.globalConfig.findUnique({
    where: { configKey: "global" },
  });

  const currentRuntime = isRecord(existing?.runtimeSettings)
    ? deepClone(existing.runtimeSettings)
    : {};
  const nextRuntimeSettings = buildTransitionRuntimeSettings(
    currentRuntime,
    nextProfile,
    resolvedConfig,
    reason,
    metrics,
  );

  await prisma.$transaction(async (tx) => {
    await tx.globalConfig.upsert({
      where: { configKey: "global" },
      create: {
        configKey: "global",
        provider: existing?.provider ?? AI_PROVIDERS.GEMINI_2_5_FLASH,
        retryCount: existing?.retryCount ?? config.qualityControl.maxAttempts,
        rewritePlanTasks: existing?.rewritePlanTasks ?? undefined,
        runtimeSettings: toInputJsonValue(nextRuntimeSettings),
        updatedBy: AUTO_PROFILE_ACTOR,
      },
      update: {
        runtimeSettings: toInputJsonValue(nextRuntimeSettings),
        updatedBy: AUTO_PROFILE_ACTOR,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "auto_profile.transition",
        actor: AUTO_PROFILE_ACTOR,
        entity: "global_config",
        entityId: "global",
        diff: {
          groupId: GROUP_ID,
          nextProfile,
          reason,
          metrics: {
            requestCount: metrics.requestCount,
            busyRate: metrics.busyRate,
            p95Ms: metrics.p95Ms,
            queueUtilization: metrics.queueUtilization,
            transientRate: metrics.transientRate,
          },
        },
      },
    });
  });

  configService.refresh();
}

async function transitionProfile(
  nextProfile: AutoProfileName,
  resolvedConfig: AutoProfileResolvedConfig,
  reason: string,
  metrics: AutoProfileMetrics,
  nowMs: number,
): Promise<void> {
  if (resolvedConfig.dryRun) {
    logger.info("auto_profile.transition.dry_run", {
      processStatus: "running",
      meta: {
        groupId: GROUP_ID,
        currentProfile: state.currentProfile,
        nextProfile,
        reason,
      },
    });
    state.lastDecisionReason = `${reason}:dry_run`;
    return;
  }

  await persistProfileTransition(nextProfile, resolvedConfig, reason, metrics);

  state.currentProfile = nextProfile;
  state.lastTransitionAtMs = nowMs;
  state.escalateStreak = 0;
  state.relaxStreak = 0;
  state.lastDecisionReason = reason;
  state.lastTransitionMetrics = metrics;

  logger.info("auto_profile.transition.applied", {
    processStatus: "running",
    meta: {
      groupId: GROUP_ID,
      nextProfile,
      reason,
      requestCount: metrics.requestCount,
      busyRate: metrics.busyRate,
      p95Ms: metrics.p95Ms,
      queueUtilization: metrics.queueUtilization,
    },
  });
}

async function evaluateAutoProfileController(): Promise<void> {
  if (evaluateInFlight) {
    return;
  }

  evaluateInFlight = true;

  try {
    const leader = await acquireLeaderLease();
    autoProfileLeader = leader;
    if (!leader) {
      return;
    }

    const runtimeSettings = await configService.getRuntimeSettings();
    const resolvedConfig = resolveAutoProfileConfig(runtimeSettings);
    lastResolvedConfig = resolvedConfig;

    if (state.currentProfile !== resolvedConfig.currentProfile) {
      state.currentProfile = resolvedConfig.currentProfile;
      state.escalateStreak = 0;
      state.relaxStreak = 0;
    }

    const nowMs = Date.now();
    if (nowMs - state.lastEvaluatedAtMs < resolvedConfig.evaluateEveryMs) {
      return;
    }

    const metrics = computeAutoProfileMetrics(metricSamples, nowMs, resolvedConfig.windowMs);
    const decision = evaluateAutoProfileTransition(state, resolvedConfig, metrics, nowMs);
    state = decision.nextState;

    if (!decision.transitionTo || !decision.reason) {
      return;
    }

    if (decision.reason.startsWith("auto_recover")) {
      const elapsedSinceTransition = nowMs - (state.lastTransitionAtMs || 0);
      if (
        state.lastTransitionAtMs > 0 &&
        elapsedSinceTransition < resolvedConfig.cooldownMs
      ) {
        state.lastDecisionReason = "cooldown_guard";
        return;
      }
    }

    await transitionProfile(
      decision.transitionTo,
      resolvedConfig,
      decision.reason,
      metrics,
      nowMs,
    );
  } catch (error) {
    logger.error("auto_profile.evaluate.failed", {
      processStatus: "failed",
      meta: {
        reason: error instanceof Error ? error.message : "unknown",
      },
    });
  } finally {
    evaluateInFlight = false;
  }
}

export function initializeAutoProfileController(): void {
  if (controllerInterval) {
    return;
  }

  controllerInterval = setInterval(() => {
    void evaluateAutoProfileController();
  }, EVALUATOR_TICK_MS);

  if (typeof controllerInterval.unref === "function") {
    controllerInterval.unref();
  }

  logger.info("auto_profile.controller.started", {
    processStatus: "running",
    meta: { groupId: GROUP_ID },
  });
}

export async function shutdownAutoProfileController(): Promise<void> {
  if (controllerInterval) {
    clearInterval(controllerInterval);
    controllerInterval = null;
  }

  await releaseLeaderLease();
}

export function getAutoProfileControllerStatus(): Record<string, unknown> {
  const nowMs = Date.now();
  const resolvedConfig = lastResolvedConfig ?? resolveAutoProfileConfig({});
  const metrics = computeAutoProfileMetrics(metricSamples, nowMs, resolvedConfig.windowMs);

  return {
    running: Boolean(controllerInterval),
    evaluateInFlight,
    isLeader: autoProfileLeader,
    mode: resolvedConfig.mode,
    enabled: resolvedConfig.enabled,
    dryRun: resolvedConfig.dryRun,
    currentProfile: state.currentProfile,
    manualProfile: resolvedConfig.manualProfile,
    evaluateEveryMs: resolvedConfig.evaluateEveryMs,
    windowMs: resolvedConfig.windowMs,
    minDwellMs: resolvedConfig.minDwellMs,
    cooldownMs: resolvedConfig.cooldownMs,
    windows: resolvedConfig.windows,
    thresholds: resolvedConfig.thresholds,
    streaks: {
      escalate: state.escalateStreak,
      relax: state.relaxStreak,
    },
    lastEvaluatedAt:
      state.lastEvaluatedAtMs > 0
        ? new Date(state.lastEvaluatedAtMs).toISOString()
        : null,
    lastTransitionAt:
      state.lastTransitionAtMs > 0
        ? new Date(state.lastTransitionAtMs).toISOString()
        : null,
    lastDecisionReason: state.lastDecisionReason,
    lastTransitionMetrics: state.lastTransitionMetrics,
    latestMetrics: metrics,
  };
}
