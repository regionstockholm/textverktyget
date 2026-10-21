import { defineModel } from "../../../validation.js";
import type { GeminiModelInput } from "../types.js";
export default defineModel({ provider: "gemini", id: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro (legacy)", aliases: ["models/gemini-1.5-pro"],
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "retired",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro"], notes: "Compatibility record for old backups; not an available current model. Register a supported replacement before processing." } } satisfies GeminiModelInput);
