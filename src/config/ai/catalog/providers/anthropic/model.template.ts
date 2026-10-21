import type { AnthropicModelInput } from "./types.js";
export const template: AnthropicModelInput = { provider: "anthropic", id: "replace-model-id", displayName: "New Claude model",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "none" }, temperature: "unsupported", structuredOutput: "prompt", status: "draft",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://platform.claude.com/docs/en/models/overview"], notes: "New adaptive-thinking generations require adapter support; do not apply the 4.5 budget policy blindly." } };
