import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  provider: "openrouter", id: "google/gemini-2.5-flash", displayName: "Gemini 2.5 Flash (OpenRouter)",
  limits: { contextWindow: 1048576, maxOutputTokens: 65535, verification: "verified" },
  reasoning: { mode: "openrouter", canDisable: true }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints"], notes: "Router endpoints report 65535 output tokens, distinct from the direct Google 65536 ceiling. Web search is not enabled by this chat adapter." },
} satisfies OpenrouterModelInput);
