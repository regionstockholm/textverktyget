import test from "node:test";
import assert from "node:assert/strict";
import {
  runTargetedRepairLoop,
  type RepairLoopDependencies,
  type RepairLoopOutcome,
} from "../services/summarize/repair-loop.js";
import type {
  QualityReportArtifact,
  RepairPlanArtifact,
} from "../services/summarize/pipeline-artifacts.js";

function makeQualityReport(): QualityReportArtifact {
  return {
    overall: 6,
    subscores: {
      fidelity: 6,
      priorityOrder: 5,
      plainLanguage: 7,
      taskFit: 7,
      audienceFit: 7,
      intentFit: 6,
    },
    failures: [
      {
        sectionKey: "lead",
        dimension: "priorityOrder",
        reason: "viktig konsekvens kommer for sent",
      },
    ],
  };
}

function makeHighOverallLowSubscoreReport(): QualityReportArtifact {
  return {
    overall: 9,
    subscores: {
      fidelity: 9,
      priorityOrder: 7,
      plainLanguage: 9,
      taskFit: 9,
      audienceFit: 9,
      intentFit: 9,
    },
    failures: [
      {
        sectionKey: "lead",
        dimension: "priorityOrder",
        reason: "viktig konsekvens kommer for sent",
      },
    ],
  };
}

function makePlan(): RepairPlanArtifact {
  return {
    remainingBudget: 1,
    actions: [
      {
        sectionKey: "lead",
        dimension: "priorityOrder",
        instruction: "Flytta viktig konsekvens till inledningen.",
      },
    ],
  };
}

test("runTargetedRepairLoop enforces bounded attempts", async () => {
  const outcomes: RepairLoopOutcome[] = [
    { score: 6, qualityReport: makeQualityReport() },
    { score: 7, qualityReport: makeQualityReport() },
    { score: 9, qualityReport: { ...makeQualityReport(), failures: [] } },
  ];

  let evaluateCalls = 0;
  let repairCalls = 0;
  let summaryUpdates = 0;

  const dependencies: RepairLoopDependencies = {
    buildPlan: () => makePlan(),
    renderPlan: () => "TARGETED REPAIR PLAN",
    applyRepair: async () => {
      repairCalls += 1;
      return { summary: `repaired-${repairCalls}` };
    },
    onRepairPlan: () => {
      return;
    },
    onSummaryUpdated: async () => {
      summaryUpdates += 1;
    },
    evaluate: async () => {
      const outcome = outcomes[evaluateCalls];
      evaluateCalls += 1;
      return outcome || { score: 10, qualityReport: undefined };
    },
  };

  const result = await runTargetedRepairLoop({
    initialOutcome: { score: 5, qualityReport: makeQualityReport() },
    config: {
      enabled: true,
      budget: 2,
      minScore: 8,
      maxActionsPerAttempt: 3,
    },
    dependencies,
  });

  assert.equal(result.attempts, 2);
  assert.equal(result.outcome.score, 7);
  assert.equal(repairCalls, 2);
  assert.equal(summaryUpdates, 2);
  assert.equal(evaluateCalls, 2);
});

test("runTargetedRepairLoop respects connection guard", async () => {
  let repaired = false;

  const result = await runTargetedRepairLoop({
    initialOutcome: { score: 5, qualityReport: makeQualityReport() },
    config: {
      enabled: true,
      budget: 3,
      minScore: 8,
      maxActionsPerAttempt: 3,
    },
    dependencies: {
      buildPlan: () => makePlan(),
      renderPlan: () => "TARGETED REPAIR PLAN",
      applyRepair: async () => {
        repaired = true;
        return { summary: "never" };
      },
      onRepairPlan: () => {
        return;
      },
      onSummaryUpdated: async () => {
        return;
      },
      evaluate: async () => ({ score: 9, qualityReport: undefined }),
      canContinue: () => false,
    },
  });

  assert.equal(result.attempts, 0);
  assert.equal(result.outcome.score, 5);
  assert.equal(repaired, false);
});

test("runTargetedRepairLoop repairs low subscore even when overall score is high", async () => {
  const outcomes: RepairLoopOutcome[] = [
    {
      score: 9,
      qualityReport: {
        overall: 9,
        subscores: {
          fidelity: 9,
          priorityOrder: 9,
          plainLanguage: 9,
          taskFit: 9,
          audienceFit: 9,
          intentFit: 9,
        },
        failures: [],
      },
    },
  ];
  let evaluateCalls = 0;

  const result = await runTargetedRepairLoop({
    initialOutcome: {
      score: 9,
      qualityReport: makeHighOverallLowSubscoreReport(),
    },
    config: {
      enabled: true,
      budget: 2,
      minScore: 8,
      minSubscore: 8,
      maxActionsPerAttempt: 3,
    },
    dependencies: {
      buildPlan: () => makePlan(),
      renderPlan: () => "TARGETED REPAIR PLAN",
      applyRepair: async () => ({ summary: "repaired" }),
      onRepairPlan: () => {
        return;
      },
      onSummaryUpdated: async () => {
        return;
      },
      evaluate: async () => {
        const outcome = outcomes[evaluateCalls];
        evaluateCalls += 1;
        return outcome || { score: 9, qualityReport: undefined };
      },
    },
  });

  assert.equal(result.attempts, 1);
  assert.equal(result.outcome.score, 9);
});
