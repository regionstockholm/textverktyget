import { defineModel } from "../../../validation.js";
import type { AnthropicModelInput } from "../types.js";
export default defineModel({ provider: "anthropic", id: "claude-opus-4-5", displayName: "Claude Opus 4.5", aliases: ["claude-opus-4-5-20251101"],
  limits: { contextWindow: 200000, maxOutputTokens: 64000, verification: "verified" }, reasoning: { mode: "anthropic-budget", minimumBudget: 1024, defaultBudget: 8192, canDisable: true },
  temperature: "without-reasoning", structuredOutput: "prompt", nativeCapabilities: { structuredOutput: true }, status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://platform.claude.com/docs/en/models/opus-4-5/overview"], notes: "Active legacy model. Extended-thinking budget must be lower than max_tokens; synchronous output limit is 64K." } } satisfies AnthropicModelInput);
