import test from "node:test";
import assert from "node:assert/strict";
import { isTransientSummarizeError } from "../routes/api.js";

test("isTransientSummarizeError identifies transient provider failures", () => {
  assert.equal(
    isTransientSummarizeError(
      new Error("Ett fel uppstod vid bearbetning av din förfrågan. Försök igen senare."),
    ),
    true,
  );
  assert.equal(
    isTransientSummarizeError(new Error("Rate limit exceeded by provider")),
    true,
  );
  assert.equal(
    isTransientSummarizeError("Ett fel uppstod vid bearbetning av din förfrågan."),
    true,
  );
});

test("isTransientSummarizeError ignores non-transient failures", () => {
  assert.equal(
    isTransientSummarizeError(new Error("Authentication failed. Invalid API key.")),
    false,
  );
  assert.equal(isTransientSummarizeError(new Error("Validation failed")), false);
  assert.equal(isTransientSummarizeError("not-an-error"), false);
});
