import test from "node:test";
import assert from "node:assert/strict";
import { validateAndNormalizeTaskSettings } from "../config/tasks/task-contract.js";

test("normalizes a valid bullets task", () => {
  const result = validateAndNormalizeTaskSettings({
    outputMode: "bullets",
    bulletCount: 4,
    maxChars: 1200,
    targetAudienceEnabled: false,
    rewritePlanEnabled: true,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.settings.outputMode, "bullets");
  assert.equal(result.settings.bulletCount, 4);
  assert.equal(result.settings.maxChars, 1200);
  assert.equal(result.settings.targetAudienceEnabled, false);
  assert.equal(result.settings.rewritePlanEnabled, true);
});

test("requires bulletCount when outputMode is bullets", () => {
  const result = validateAndNormalizeTaskSettings({
    outputMode: "bullets",
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes("bulletCount is required when outputMode is bullets"),
  );
});

test("rejects bulletCount for non-bullets tasks", () => {
  const result = validateAndNormalizeTaskSettings({
    outputMode: "rewrite",
    bulletCount: 4,
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes("bulletCount is only allowed when outputMode is bullets"),
  );
  assert.equal(result.settings.bulletCount, null);
});

test("rejects unsupported output mode", () => {
  const result = validateAndNormalizeTaskSettings({
    outputMode: "translation",
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes("outputMode must be one of rewrite, summary, bullets"),
  );
});
