import { defineModel } from "../../../validation.js";
import type { OpenaiModelInput } from "../types.js";
export default defineModel({ provider: "openai", id: "gpt-5.4", displayName: "GPT-5.4", aliases: ["gpt-5.4-2026-03-05"],
  limits: { contextWindow: 1050000, maxOutputTokens: 128000, verification: "verified" }, reasoning: { mode: "effort", enabledEffort: "low", disabledEffort: "none", canDisable: true },
  outputTokenParameter: "max_completion_tokens", temperature: "unsupported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://developers.openai.com/api/docs/models/gpt-5.4"], notes: "Supports none/low/medium/high/xhigh effort. Temperature is omitted for compatibility with reasoning-enabled calls. Output includes reasoning tokens." } } satisfies OpenaiModelInput);
