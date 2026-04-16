import test from "node:test";
import assert from "node:assert/strict";
import { prepareEvaluationPrompt } from "../services/quality-evaluation-prompt-builder.js";

test("prepareEvaluationPrompt injects rewrite draft when present", () => {
  const prompt = prepareEvaluationPrompt(
    "Original text",
    "Processed text",
    "System prompt",
    "- Viktigast först\n- Bakgrund sist",
  );

  assert.match(prompt, /Original text/);
  assert.match(prompt, /Processed text/);
  assert.match(prompt, /System prompt/);
  assert.match(prompt, /Viktigast först/);
  assert.match(prompt, /Bakgrund sist/);
  assert.ok(!prompt.includes("[Infoga Omskrivningsutkast här]"));
});

test("prepareEvaluationPrompt falls back to empty rewrite draft", () => {
  const prompt = prepareEvaluationPrompt(
    "Original text",
    "Processed text",
    "System prompt",
  );

  assert.match(prompt, /Original text/);
  assert.match(prompt, /Processed text/);
  assert.match(prompt, /System prompt/);
  assert.ok(!prompt.includes("[Infoga Omskrivningsutkast här]"));
});

test("prepareEvaluationPrompt injects sender intent when present", () => {
  const prompt = prepareEvaluationPrompt(
    "Original text",
    "Processed text",
    "System prompt",
    "- Viktigast forst",
    undefined,
    "Region Stockholm vill vara transparent och inkluderande.",
  );

  assert.match(prompt, /transparent och inkluderande/);
  assert.ok(!prompt.includes("[Infoga Avsändarens intention här]"));
});

test("prepareEvaluationPrompt injects task context placeholders", () => {
  const template = [
    "Task: [Infoga Task key här]",
    "Audience: [Infoga Målgrupp här]",
    "SummaryType: [Infoga SummaryTextType här]",
    "OutputMode: [Infoga TaskOutputMode här]",
  ].join("\n");

  const prompt = prepareEvaluationPrompt(
    "Original text",
    "Processed text",
    "System prompt",
    undefined,
    template,
    undefined,
    {
      taskKey: "easyToRead",
      targetAudience: "Patienter",
      taskOutputMode: "rewrite",
    },
  );

  assert.match(prompt, /Task: easyToRead/);
  assert.match(prompt, /Audience: Patienter/);
  assert.match(prompt, /SummaryType:\s*$/m);
  assert.match(prompt, /OutputMode: rewrite/);
});
