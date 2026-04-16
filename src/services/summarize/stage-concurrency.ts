import { config } from "../../config/app-config.js";
import { readRuntimeInteger } from "../../utils/runtime-number.js";

export type StageName = "analysis" | "rewrite" | "critic";

export type StageConcurrencyConfig = Record<StageName, number>;

type StageState = {
  running: number;
  queue: Array<() => void>;
};

const stageStates: Record<StageName, StageState> = {
  analysis: { running: 0, queue: [] },
  rewrite: { running: 0, queue: [] },
  critic: { running: 0, queue: [] },
};

export function resolveStageConcurrencyConfig(
  runtimeSettings: unknown,
): StageConcurrencyConfig {
  const defaults: StageConcurrencyConfig = {
    analysis: 32,
    rewrite: config.performance.summarizeQueue.maxConcurrentJobs,
    critic: 16,
  };

  const stageConcurrency =
    runtimeSettings && typeof runtimeSettings === "object"
      ? (runtimeSettings as Record<string, unknown>).stageConcurrency
      : undefined;

  if (!stageConcurrency || typeof stageConcurrency !== "object") {
    return defaults;
  }

  const raw = stageConcurrency as Record<string, unknown>;
  return {
    analysis: readRuntimeInteger(raw.analysis, defaults.analysis, 1, 200),
    rewrite: readRuntimeInteger(raw.rewrite, defaults.rewrite, 1, 200),
    critic: readRuntimeInteger(raw.critic, defaults.critic, 1, 200),
  };
}

async function acquireSlot(stage: StageName, limit: number): Promise<void> {
  const state = stageStates[stage];
  if (state.running < limit) {
    state.running += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    state.queue.push(resolve);
  });
  state.running += 1;
}

function releaseSlot(stage: StageName): void {
  const state = stageStates[stage];
  state.running = Math.max(0, state.running - 1);
  const next = state.queue.shift();
  if (next) {
    next();
  }
}

export async function runWithStageConcurrency<T>(
  stage: StageName,
  runtimeSettings: unknown,
  task: () => Promise<T>,
): Promise<T> {
  const limits = resolveStageConcurrencyConfig(runtimeSettings);
  const limit = limits[stage];
  await acquireSlot(stage, limit);

  try {
    return await task();
  } finally {
    releaseSlot(stage);
  }
}

export function getStageConcurrencyState() {
  return {
    analysis: {
      running: stageStates.analysis.running,
      queued: stageStates.analysis.queue.length,
    },
    rewrite: {
      running: stageStates.rewrite.running,
      queued: stageStates.rewrite.queue.length,
    },
    critic: {
      running: stageStates.critic.running,
      queued: stageStates.critic.queue.length,
    },
  };
}
