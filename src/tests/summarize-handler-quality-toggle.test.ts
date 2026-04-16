import test from "node:test";
import assert from "node:assert/strict";
import { shouldRunQualityEvaluation } from "../config/ai/summarize-handler.js";

test("shouldRunQualityEvaluation defaults to enabled", () => {
  assert.equal(shouldRunQualityEvaluation(undefined, {}), true);
});

test("shouldRunQualityEvaluation respects request-level opt-out", () => {
  assert.equal(shouldRunQualityEvaluation(false, {}), false);
});

test("shouldRunQualityEvaluation respects runtime quality toggle", () => {
  assert.equal(
    shouldRunQualityEvaluation(true, {
      quality: { enabled: false },
    }),
    false,
  );
});
