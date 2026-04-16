import test from "node:test";
import assert from "node:assert/strict";
import { executeQualityRepairFlow } from "../config/ai/summarize-handler.js";
import type { ProcessingOptions } from "../config/ai/ai-service-types.js";
import type { QualityReportArtifact } from "../services/summarize/pipeline-artifacts.js";

function createFailedReport(): QualityReportArtifact {
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

function createPassedReport(): QualityReportArtifact {
  return {
    overall: 9,
    subscores: {
      fidelity: 9,
      priorityOrder: 9,
      plainLanguage: 8,
      taskFit: 9,
      audienceFit: 8,
      intentFit: 9,
    },
    failures: [],
  };
}

function createHighOverallLowSubscoreReport(): QualityReportArtifact {
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
    failures: [],
  };
}

function createProcessingOptions(): ProcessingOptions {
  return {
    taskKey: "group-a:four-bullets",
    paragraphCount: "ingress",
    targetAudience: "invanare",
    checkboxContent: "klarsprak",
    rewriteBlueprint: "REWRITE BLUEPRINT",
  };
}

test("executeQualityRepairFlow persists repaired text and processing options", async () => {
  const processingOptions = createProcessingOptions();
  const combinedResult = {
    summary: "initial summary",
    originalLength: 200,
    summaryLength: 14,
    processingTime: 1,
    compressionRatio: 7,
    systemMessage: "system",
  };

  const qualityOutcomes = [
    { score: 6, qualityReport: createFailedReport() },
    { score: 9, qualityReport: createPassedReport() },
  ];
  let qualityIndex = 0;

  const processedTextUpdates: string[] = [];
  const processingOptionsUpdates: ProcessingOptions[] = [];

  const result = await executeQualityRepairFlow({
    combinedResult,
    processingOptions,
    targetedRepairEnabled: true,
    repairBudget: 2,
    repairMinScore: 8,
    repairMinSubscore: 8,
    repairMaxActions: 3,
    evaluateQuality: async () => {
      const outcome = qualityOutcomes[qualityIndex];
      qualityIndex += 1;
      return outcome || { score: 10 };
    },
    applyRepair: async () => ({
      summary: "repaired summary",
      systemMessage: "repaired-system",
    }),
    updateProcessedText: async (summary) => {
      processedTextUpdates.push(summary);
    },
    updateProcessingOptions: async (optionsToPersist) => {
      processingOptionsUpdates.push({ ...optionsToPersist });
    },
  });

  assert.equal(result.qualityScore, 9);
  assert.equal(result.qualityPassed, true);
  assert.deepEqual(result.failingDimensions, []);
  assert.equal(result.qualityGateReason, "pass");
  assert.equal(result.repairAttempts, 1);
  assert.equal(processedTextUpdates.length, 1);
  assert.equal(processedTextUpdates[0], "repaired summary");
  assert.equal(processingOptionsUpdates.length, 1);
  assert.equal(combinedResult.summary, "repaired summary");
  assert.equal(combinedResult.systemMessage, "repaired-system");
  assert.equal(combinedResult.summaryLength, "repaired summary".length);

  const persistedOptions = processingOptionsUpdates[0];
  assert.ok(persistedOptions?.repairPlanArtifact);
  assert.ok(persistedOptions?.qualityReportArtifact);

  const persistedReportRaw = persistedOptions?.qualityReportArtifact;
  if (typeof persistedReportRaw !== "string") {
    throw new Error("Expected persisted quality report artifact");
  }
  const persistedReport = JSON.parse(persistedReportRaw) as QualityReportArtifact;
  assert.equal(persistedReport.overall, 9);
});

test("executeQualityRepairFlow persists options without repair when disabled", async () => {
  const processingOptions = createProcessingOptions();
  const combinedResult = {
    summary: "initial summary",
    originalLength: 180,
    summaryLength: 14,
    processingTime: 1,
    compressionRatio: 8,
  };

  let processedUpdateCount = 0;
  const processingOptionsUpdates: ProcessingOptions[] = [];

  const result = await executeQualityRepairFlow({
    combinedResult,
    processingOptions,
    targetedRepairEnabled: false,
    repairBudget: 2,
    repairMinScore: 8,
    repairMinSubscore: 8,
    repairMaxActions: 3,
    evaluateQuality: async () => ({
      score: 7,
      qualityReport: createFailedReport(),
    }),
    applyRepair: async () => ({ summary: "should-not-be-used" }),
    updateProcessedText: async () => {
      processedUpdateCount += 1;
    },
    updateProcessingOptions: async (optionsToPersist) => {
      processingOptionsUpdates.push({ ...optionsToPersist });
    },
  });

  assert.equal(result.qualityScore, 7);
  assert.equal(result.qualityPassed, false);
  assert.equal(result.qualityGateReason, "overall");
  assert.equal(result.repairAttempts, 0);
  assert.equal(processedUpdateCount, 0);
  assert.equal(processingOptionsUpdates.length, 1);
  const persistedOptions = processingOptionsUpdates[0];
  assert.ok(persistedOptions?.qualityReportArtifact);
});

test("executeQualityRepairFlow fails strict gate when any subscore is below threshold", async () => {
  const processingOptions = createProcessingOptions();
  const combinedResult = {
    summary: "initial summary",
    originalLength: 160,
    summaryLength: 14,
    processingTime: 1,
    compressionRatio: 9,
  };

  const result = await executeQualityRepairFlow({
    combinedResult,
    processingOptions,
    targetedRepairEnabled: false,
    repairBudget: 1,
    repairMinScore: 8,
    repairMinSubscore: 8,
    repairMaxActions: 3,
    evaluateQuality: async () => ({
      score: 9,
      qualityReport: createHighOverallLowSubscoreReport(),
    }),
    applyRepair: async () => ({ summary: "not-used" }),
    updateProcessedText: async () => {
      return;
    },
    updateProcessingOptions: async () => {
      return;
    },
  });

  assert.equal(result.qualityScore, 9);
  assert.equal(result.qualityPassed, false);
  assert.equal(result.qualityGateReason, "subscores");
  assert.deepEqual(result.failingDimensions, ["priorityOrder"]);
});
