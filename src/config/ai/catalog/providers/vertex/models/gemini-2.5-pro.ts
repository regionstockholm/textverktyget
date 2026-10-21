import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  provider: "vertex", id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro (Vertex)", aliases: ["models/gemini-2.5-pro"],
  limits: { contextWindow: 1048576, maxOutputTokens: 65536, verification: "verified" },
  reasoning: { mode: "gemini-budget", enabledBudget: -1, disabledBudget: 128, canDisable: false }, temperature: "supported", structuredOutput: "json-schema", webSearch: true, status: "deprecated",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro"], retirementDate: "2026-10-20", notes: "Thinking cannot be disabled. Cloud retirement scheduled October 20, 2026; do not silently substitute another model." },
} satisfies VertexModelInput);
