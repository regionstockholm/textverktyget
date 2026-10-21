import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  provider: "openrouter", id: "openai/gpt-4.1", displayName: "GPT-4.1 (OpenRouter)",
  limits: { contextWindow: 1047576, maxOutputTokens: 32768, verification: "verified" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://openrouter.ai/api/v1/models/openai/gpt-4.1/endpoints", "https://developers.openai.com/api/docs/models/gpt-4.1"], notes: "Use the direct OpenAI 32768 ceiling shared by the OpenAI route, not the unusually large Azure endpoint value returned by the router." },
} satisfies OpenrouterModelInput);
