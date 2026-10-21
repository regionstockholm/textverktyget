import { defineModel } from "../../../validation.js";
import type { GeminiModelInput } from "../types.js";
export default defineModel({
  provider: "gemini", id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", aliases: ["models/gemini-2.5-pro"],
  limits: { contextWindow: 1048576, maxOutputTokens: 65536, verification: "verified" },
  reasoning: { mode: "gemini-budget", enabledBudget: -1, disabledBudget: 128, canDisable: false },
  temperature: "supported", structuredOutput: "json-schema", webSearch: true, status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro"], notes: "Pro cannot disable thinking; the lowest budget is 128. Cloud lifecycle is tracked separately in the Vertex definition." },
} satisfies GeminiModelInput);
