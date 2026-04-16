import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRepairPlan,
  renderRepairBlueprint,
} from "../services/summarize/targeted-repair.js";
import type {
  QualityReportArtifact,
  RepairPlanArtifact,
} from "../services/summarize/pipeline-artifacts.js";

test("buildRepairPlan prioritizes critical dimensions", () => {
  const report: QualityReportArtifact = {
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
        sectionKey: "context",
        dimension: "plainLanguage",
        reason: "for lange meningar",
      },
      {
        sectionKey: "lead",
        dimension: "fidelity",
        reason: "en viktig faktauppgift saknas",
      },
      {
        sectionKey: "lead",
        dimension: "priorityOrder",
        reason: "viktig konsekvens ligger for sent",
      },
    ],
  };

  const plan = buildRepairPlan(report, 2, 2);
  assert.equal(plan.remainingBudget, 2);
  assert.equal(plan.actions.length, 2);
  assert.equal(plan.actions[0]?.dimension, "fidelity");
  assert.equal(plan.actions[1]?.dimension, "priorityOrder");
});

test("renderRepairBlueprint outputs targeted instructions", () => {
  const plan: RepairPlanArtifact = {
    remainingBudget: 1,
    actions: [
      {
        sectionKey: "lead",
        dimension: "intentFit",
        instruction: "Stark transparens i inledningen.",
      },
    ],
  };

  const blueprint = renderRepairBlueprint(plan);
  assert.match(blueprint, /TARGETED REPAIR PLAN/);
  assert.match(blueprint, /lead/);
  assert.match(blueprint, /intent fit/);
});
