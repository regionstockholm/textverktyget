import { defineModel } from "../../../validation.js";
import type { AnthropicModelInput } from "../types.js";
export default defineModel({ provider: "anthropic", id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", aliases: ["claude-haiku-4-5-20251001"],
  limits: { contextWindow: 200000, maxOutputTokens: 64000, verification: "verified" }, reasoning: { mode: "anthropic-budget", minimumBudget: 1024, defaultBudget: 8192, canDisable: true },
  temperature: "without-reasoning", structuredOutput: "prompt", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://platform.claude.com/docs/en/models/haiku-4-5/overview"], notes: "Manual extended thinking, not adaptive thinking. Retirement commitment is not a scheduled retirement date." } } satisfies AnthropicModelInput);
