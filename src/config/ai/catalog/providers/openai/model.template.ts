import type { OpenaiModelInput } from "./types.js";
export const template: OpenaiModelInput = { provider: "openai", id: "replace-model-id", displayName: "New OpenAI model",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "draft",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://developers.openai.com/api/docs/models"], notes: "Set exact output parameter and effort values; do not infer from the name." } };
