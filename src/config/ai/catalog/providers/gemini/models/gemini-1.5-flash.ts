import { defineModel } from "../../../validation.js";
import type { GeminiModelInput } from "../types.js";
export default defineModel({ provider: "gemini", id: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash (legacy)", aliases: ["models/gemini-1.5-flash"],
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "retired",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash"], notes: "Compatibility record only; never substituted automatically for a current model." } } satisfies GeminiModelInput);
