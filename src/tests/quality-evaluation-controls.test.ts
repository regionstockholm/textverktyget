import test from "node:test";
import assert from "node:assert/strict";
import { parseQualityEvaluationResponse } from "../services/quality-evaluation-controls.js";

test("parseQualityEvaluationResponse parses structured JSON report", () => {
  const payload = JSON.stringify({
    overall: 8,
    subscores: {
      fidelity: 9,
      priorityOrder: 7,
      plainLanguage: 8,
      taskFit: 8,
      audienceFit: 7,
      intentFit: 9,
    },
    failures: [
      {
        sectionKey: "context",
        dimension: "priorityOrder",
        reason: "viktig konsekvens kommer for sent",
      },
    ],
  });

  const parsed = parseQualityEvaluationResponse(payload);
  assert.equal(parsed.score, 8);
  assert.ok(parsed.qualityReport);
  assert.equal(parsed.qualityReport?.subscores.intentFit, 9);
});

test("parseQualityEvaluationResponse accepts JSON in code fence", () => {
  const payload = [
    "```json",
    '{"overall":7,"subscores":{"fidelity":7,"priorityOrder":7,"plainLanguage":7,"taskFit":7,"audienceFit":7,"intentFit":7},"failures":[]}',
    "```",
  ].join("\n");

  const parsed = parseQualityEvaluationResponse(payload);
  assert.equal(parsed.score, 7);
  assert.ok(parsed.qualityReport);
});

test("parseQualityEvaluationResponse falls back to numeric score", () => {
  const parsed = parseQualityEvaluationResponse("6");
  assert.equal(parsed.score, 6);
  assert.equal(parsed.qualityReport, undefined);
});

test("parseQualityEvaluationResponse throws on invalid non-numeric response", () => {
  assert.throws(
    () => parseQualityEvaluationResponse("inte ett giltigt svar"),
    /Invalid score received from AI/,
  );
});
