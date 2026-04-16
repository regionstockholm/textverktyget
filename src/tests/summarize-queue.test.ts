import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../config/app-config.js";
import {
  enqueueSummarize,
  getSummarizeQueueState,
  resolveRuntimeSummarizeQueueConfig,
  SummarizeQueueOverloadedError,
  SummarizeQueueTimeoutError,
} from "../services/summarize/summarize-queue.js";

type QueueConfigSnapshot = {
  maxConcurrentJobs: number;
  maxQueueSize: number;
  maxWaitMs: number;
  retryAfterSeconds: number;
};

function snapshotQueueConfig(): QueueConfigSnapshot {
  return { ...config.performance.summarizeQueue };
}

function restoreQueueConfig(snapshot: QueueConfigSnapshot): void {
  config.performance.summarizeQueue.maxConcurrentJobs = snapshot.maxConcurrentJobs;
  config.performance.summarizeQueue.maxQueueSize = snapshot.maxQueueSize;
  config.performance.summarizeQueue.maxWaitMs = snapshot.maxWaitMs;
  config.performance.summarizeQueue.retryAfterSeconds = snapshot.retryAfterSeconds;
}

test("summarize queue rejects when queue is full", async () => {
  const previous = snapshotQueueConfig();
  config.performance.summarizeQueue.maxConcurrentJobs = 1;
  config.performance.summarizeQueue.maxQueueSize = 1;
  config.performance.summarizeQueue.maxWaitMs = 1000;

  let releaseFirstJob: () => void = () => undefined;
  const firstJob = new Promise<string>((resolve) => {
    releaseFirstJob = () => resolve("first");
  });

  try {
    const running = enqueueSummarize(() => firstJob);
    const queued = enqueueSummarize(async () => "second");

    assert.throws(
      () => enqueueSummarize(async () => "third"),
      SummarizeQueueOverloadedError,
    );

    releaseFirstJob();
    assert.equal(await running, "first");
    assert.equal(await queued, "second");
  } finally {
    restoreQueueConfig(previous);
  }
});

test("summarize queue times out waiting jobs", async () => {
  const previous = snapshotQueueConfig();
  config.performance.summarizeQueue.maxConcurrentJobs = 1;
  config.performance.summarizeQueue.maxQueueSize = 2;
  config.performance.summarizeQueue.maxWaitMs = 40;

  let releaseFirstJob: () => void = () => undefined;
  const firstJob = new Promise<string>((resolve) => {
    releaseFirstJob = () => resolve("first");
  });

  try {
    const running = enqueueSummarize(() => firstJob);

    await assert.rejects(
      () => enqueueSummarize(async () => "second"),
      SummarizeQueueTimeoutError,
    );

    releaseFirstJob();
    assert.equal(await running, "first");
  } finally {
    restoreQueueConfig(previous);
  }
});

test("summarize queue state reports capacity and usage", async () => {
  const state = getSummarizeQueueState();
  assert.equal(typeof state.runningJobs, "number");
  assert.equal(typeof state.queuedJobs, "number");
  assert.equal(typeof state.maxConcurrentJobs, "number");
  assert.equal(typeof state.maxQueueSize, "number");
});

test("summarize queue runs jobs up to configured concurrency", async () => {
  const previous = snapshotQueueConfig();
  config.performance.summarizeQueue.maxConcurrentJobs = 2;
  config.performance.summarizeQueue.maxQueueSize = 10;
  config.performance.summarizeQueue.maxWaitMs = 1000;

  let activeJobs = 0;
  let peakActiveJobs = 0;

  const createJob = () =>
    enqueueSummarize(async () => {
      activeJobs += 1;
      peakActiveJobs = Math.max(peakActiveJobs, activeJobs);
      await new Promise((resolve) => setTimeout(resolve, 30));
      activeJobs -= 1;
      return "ok";
    });

  try {
    const results = await Promise.all([createJob(), createJob(), createJob()]);
    assert.deepEqual(results, ["ok", "ok", "ok"]);
    assert.equal(peakActiveJobs, 2);
  } finally {
    restoreQueueConfig(previous);
  }
});

test("summarize queue resolves runtime config overrides", () => {
  const resolved = resolveRuntimeSummarizeQueueConfig({
    summarizeQueue: {
      maxConcurrentJobs: 12,
      maxQueueSize: 300,
      maxWaitMs: 60000,
      retryAfterSeconds: 25,
      sharedTokenTtlMs: 120000,
    },
  });

  assert.equal(resolved.maxConcurrentJobs, 12);
  assert.equal(resolved.maxQueueSize, 300);
  assert.equal(resolved.maxWaitMs, 60000);
  assert.equal(resolved.retryAfterSeconds, 25);
  assert.equal(resolved.sharedTokenTtlMs, 120000);
});
