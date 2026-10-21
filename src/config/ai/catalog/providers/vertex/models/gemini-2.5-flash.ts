import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  provider: "vertex", id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash (Vertex)", aliases: ["models/gemini-2.5-flash"],
  limits: { contextWindow: 1048576, maxOutputTokens: 65536, verification: "verified" },
  reasoning: { mode: "gemini-budget", enabledBudget: -1, disabledBudget: 0, canDisable: true }, temperature: "supported", structuredOutput: "json-schema", webSearch: true, status: "deprecated",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash"], retirementDate: "2026-10-20", notes: "Cloud documentation schedules retirement October 20, 2026. This lifecycle record is specific to Vertex; it is not applied to the direct Gemini API." },
} satisfies VertexModelInput);
