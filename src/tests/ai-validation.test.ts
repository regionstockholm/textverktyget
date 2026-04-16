import test from "node:test";
import assert from "node:assert/strict";
import { validateSummarizeRequest } from "../config/ai/ai-validation.js";

test("validateSummarizeRequest requires taskKey", () => {
  const result = validateSummarizeRequest({
    text: "Detta ar en testtext som ar tillrackligt lang.",
    checkboxContent: [],
  });

  assert.equal(result.valid, false);
  assert.equal(result.error, "Missing taskKey");
});

test("validateSummarizeRequest accepts task-key-first payload", () => {
  const result = validateSummarizeRequest({
    text: "Detta ar en testtext som ar tillrackligt lang.",
    taskKey: "group:four-bullets",
    checkboxContent: [],
  });

  assert.equal(result.valid, true);
});

test("validateSummarizeRequest rejects empty taskKey", () => {
  const result = validateSummarizeRequest({
    text: "Detta ar en testtext som ar tillrackligt lang.",
    taskKey: "   ",
    checkboxContent: [],
  });

  assert.equal(result.valid, false);
  assert.equal(result.error, "Missing taskKey");
});

test("validateSummarizeRequest accepts prompt-first payload", () => {
  const result = validateSummarizeRequest({
    text: "Detta ar en testtext som ar tillrackligt lang.",
    taskKey: "summary:shorten",
    checkboxContent: [],
  });

  assert.equal(result.valid, true);
});
