import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAudienceProfileArtifact,
  validateImportanceMapArtifact,
  validateQualityReportArtifact,
  validateRepairPlanArtifact,
  validateRewriteBlueprintArtifact,
  validateSenderIntentProfileArtifact,
} from "../services/summarize/pipeline-artifacts.js";

test("pipeline artifact validators accept valid payloads", () => {
  const audienceProfile = {
    targetAudience: "no specific group",
    priorityMode: "generic",
    textType: "general",
  };
  const senderIntentProfile = {
    summary: "transparens och tydlighet",
    priorities: ["transparens och tydlighet"],
  };
  const importanceMap = {
    rankingPolicy: "core-first",
    items: [
      {
        id: "fact-1",
        sentence: "Region Stockholm beslutar om fler vårdplatser.",
        sourceSpan: { start: 0, end: 45 },
        weights: {
          coreImportance: 9,
          audienceRelevance: 8,
          senderIntentAlignment: 7,
          riskIfOmitted: 8,
          actionability: 4,
        },
        totalScore: 8.01,
      },
    ],
  };
  const rewriteBlueprint = {
    rankingPolicy: "core-first",
    sections: [
      {
        key: "core-message",
        title: "Kärnbudskap",
        objective: "Inled med det viktigaste budskapet.",
        itemIds: ["fact-1"],
      },
      {
        key: "impact",
        title: "Vad det betyder för invånaren",
        objective: "Beskriv konsekvenser.",
        itemIds: [],
      },
      {
        key: "context",
        title: "Bakgrund",
        objective: "Lagg till kontext.",
        itemIds: [],
      },
    ],
  };
  const qualityReport = {
    overall: 8,
    subscores: {
      fidelity: 9,
      priorityOrder: 8,
      plainLanguage: 8,
      taskFit: 7,
      audienceFit: 8,
      intentFit: 8,
    },
    failures: [],
  };
  const repairPlan = {
    remainingBudget: 2,
    actions: [
      {
        sectionKey: "impact",
        dimension: "plainLanguage",
        instruction: "Kortare meningar och enklare ord.",
      },
    ],
  };

  assert.equal(validateAudienceProfileArtifact(audienceProfile), true);
  assert.equal(validateSenderIntentProfileArtifact(senderIntentProfile), true);
  assert.equal(validateImportanceMapArtifact(importanceMap), true);
  assert.equal(validateRewriteBlueprintArtifact(rewriteBlueprint), true);
  assert.equal(validateQualityReportArtifact(qualityReport), true);
  assert.equal(validateRepairPlanArtifact(repairPlan), true);
});

test("pipeline artifact validators reject malformed payloads", () => {
  assert.equal(
    validateAudienceProfileArtifact({
      targetAudience: "",
      priorityMode: "generic",
    }),
    false,
  );
  assert.equal(
    validateSenderIntentProfileArtifact({ summary: "ok", priorities: ["", 1] }),
    false,
  );
  assert.equal(
    validateImportanceMapArtifact({
      rankingPolicy: "core-first",
      items: [{ id: "x" }],
    }),
    false,
  );
  assert.equal(
    validateRewriteBlueprintArtifact({
      rankingPolicy: "core-first",
      sections: [{}],
    }),
    false,
  );
  assert.equal(
    validateQualityReportArtifact({ overall: 11, subscores: {}, failures: [] }),
    false,
  );
  assert.equal(
    validateRepairPlanArtifact({ remainingBudget: -1, actions: [] }),
    false,
  );
});
