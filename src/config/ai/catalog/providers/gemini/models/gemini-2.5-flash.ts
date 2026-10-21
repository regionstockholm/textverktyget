import { defineModel } from "../../../validation.js";
import type { GeminiModelInput } from "../types.js";
export default defineModel({
  provider: "gemini", id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash",
  aliases: ["models/gemini-2.5-flash"],
  limits: { contextWindow: 1048576, maxOutputTokens: 65536, verification: "verified" },
  reasoning: { mode: "gemini-budget", enabledBudget: -1, disabledBudget: 0, canDisable: true },
  temperature: "supported", structuredOutput: "json-schema", webSearch: true,
  status: "active", metadata: { reviewedAt: "2026-10-02", revision: 1,
    sources: ["https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash"],
    notes: "Limits checked in Google's model reference. Vertex retirement dates do not apply automatically to the Gemini Developer API; direct documentation redirected to authentication during review." },
  readiness: { adapter: "supported", specifications: "verified", live: "passed" },
} satisfies GeminiModelInput);
