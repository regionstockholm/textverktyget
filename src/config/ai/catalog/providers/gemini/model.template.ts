import type { GeminiModelInput } from "./types.js";
// Copy into models/, fill in the reviewed values, then explicitly import it in index.ts.
export const template: GeminiModelInput = { provider: "gemini", id: "replace-model-id", displayName: "New Gemini model",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "none" },
  temperature: "supported", structuredOutput: "prompt", status: "draft",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://ai.google.dev/gemini-api/docs/models"], notes: "Replace with model-specific source and request policy." } };
