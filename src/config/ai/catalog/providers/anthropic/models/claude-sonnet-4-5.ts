import { defineModel } from "../../../validation.js";
import type { AnthropicModelInput } from "../types.js";
export default defineModel({ provider: "anthropic", id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5", aliases: ["claude-sonnet-4-5-20250929"],
  limits: { contextWindow: 200000, maxOutputTokens: 64000, verification: "verified" }, reasoning: { mode: "anthropic-budget", minimumBudget: 1024, defaultBudget: 8192, canDisable: true },
  temperature: "without-reasoning", structuredOutput: "prompt", nativeCapabilities: { structuredOutput: true, webSearch: true }, status: "deprecated",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://platform.claude.com/docs/en/about-claude/model-deprecations", "https://platform.claude.com/docs/en/build-with-claude/extended-thinking"], retirementDate: "2026-11-30", notes: "Deprecated September 30, 2026. 1M context requires additional service configuration; this profile uses standard 200K. JSON evaluation is prompt-based in this adapter." } } satisfies AnthropicModelInput);
