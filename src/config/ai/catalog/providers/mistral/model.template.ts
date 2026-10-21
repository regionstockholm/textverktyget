import type { MistralModelInput } from "./types.js";
export const template: MistralModelInput = { provider: "mistral", id: "replace-model-id", displayName: "New Mistral model",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "draft",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.mistral.ai/getting-started/models"], notes: "Verify alias target and distinguish context from maximum output." } };
