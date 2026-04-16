import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureDimensionFailures,
  evaluateQualityGate,
} from "../services/summarize/quality-gate.js";
import type { QualityReportArtifact } from "../services/summarize/pipeline-artifacts.js";

function makeReport(overrides?: Partial<QualityReportArtifact>): QualityReportArtifact {
  return {
    overall: 8,
    subscores: {
      fidelity: 8,
      priorityOrder: 8,
      plainLanguage: 8,
      taskFit: 8,
      audienceFit: 8,
      intentFit: 8,
    },
    failures: [],
    ...overrides,
  };
}

test("evaluateQualityGate passes when overall and all subscores meet threshold", () => {
  const result = evaluateQualityGate(
    {
      score: 8,
      qualityReport: makeReport(),
    },
    {
      minOverall: 8,
      minSubscore: 8,
      requireStructuredReport: true,
    },
  );

  assert.equal(result.passes, true);
  assert.equal(result.reason, "pass");
  assert.deepEqual(result.failingDimensions, []);
});

test("evaluateQualityGate fails when any subscore is below threshold", () => {
  const report = makeReport({
    overall: 9,
    subscores: {
      fidelity: 9,
      priorityOrder: 9,
      plainLanguage: 7,
      taskFit: 9,
      audienceFit: 9,
      intentFit: 9,
    },
  });

  const result = evaluateQualityGate(
    {
      score: 9,
      qualityReport: report,
    },
    {
      minOverall: 8,
      minSubscore: 8,
      requireStructuredReport: true,
    },
  );

  assert.equal(result.passes, false);
  assert.equal(result.reason, "subscores");
  assert.deepEqual(result.failingDimensions, ["plainLanguage"]);
});

test("evaluateQualityGate applies dimension-specific threshold overrides", () => {
  const report = makeReport({
    overall: 9,
    subscores: {
      fidelity: 9,
      priorityOrder: 9,
      plainLanguage: 8,
      taskFit: 8,
      audienceFit: 9,
      intentFit: 9,
    },
  });

  const result = evaluateQualityGate(
    {
      score: 9,
      qualityReport: report,
    },
    {
      minOverall: 8,
      minSubscore: 8,
      dimensionThresholds: {
        plainLanguage: 9,
        taskFit: 9,
      },
      requireStructuredReport: true,
    },
  );

  assert.equal(result.passes, false);
  assert.equal(result.reason, "subscores");
  assert.deepEqual(result.failingDimensions.sort(), ["plainLanguage", "taskFit"]);
});

test("evaluateQualityGate fails closed when structured report is missing", () => {
  const result = evaluateQualityGate(
    {
      score: 10,
    },
    {
      minOverall: 8,
      minSubscore: 8,
      requireStructuredReport: true,
    },
  );

  assert.equal(result.passes, false);
  assert.equal(result.reason, "missing_report");
});

test("ensureDimensionFailures synthesizes missing failures for failing dimensions", () => {
  const report = makeReport({
    overall: 9,
    subscores: {
      fidelity: 9,
      priorityOrder: 7,
      plainLanguage: 6,
      taskFit: 9,
      audienceFit: 9,
      intentFit: 9,
    },
    failures: [],
  });

  const normalized = ensureDimensionFailures(report, 8);
  const failureDimensions = normalized.failures.map((failure) => failure.dimension);

  assert.deepEqual(failureDimensions.sort(), ["plainLanguage", "priorityOrder"]);
});

test("ensureDimensionFailures uses dimension-specific thresholds", () => {
  const report = makeReport({
    overall: 9,
    subscores: {
      fidelity: 9,
      priorityOrder: 9,
      plainLanguage: 8,
      taskFit: 8,
      audienceFit: 9,
      intentFit: 9,
    },
    failures: [],
  });

  const normalized = ensureDimensionFailures(report, 8, {
    plainLanguage: 9,
    taskFit: 9,
  });
  const failureDimensions = normalized.failures.map((failure) => failure.dimension);

  assert.deepEqual(failureDimensions.sort(), ["plainLanguage", "taskFit"]);
});
