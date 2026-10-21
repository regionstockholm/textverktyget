import { defineModel } from "../../../validation.js";
import type { GeminiModelInput } from "../types.js";
export default defineModel({
  provider: "gemini", id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash-Lite", aliases: ["models/gemini-2.5-flash-lite"],
  limits: { contextWindow: 1048576, maxOutputTokens: 65536, verification: "verified" },
  reasoning: { mode: "gemini-budget", enabledBudget: -1, disabledBudget: 0, canDisable: true },
  temperature: "supported", structuredOutput: "json-schema", webSearch: true, status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite"], notes: "Thinking is supported and enabled by the application's default, although the service may default it off." },
} satisfies GeminiModelInput);
