import { defineModel } from "../../../validation.js";
import type { MistralModelInput } from "../types.js";
export default defineModel({ provider: "mistral", id: "mistral-large-latest", displayName: "Mistral Large 3 (latest alias)", aliases: ["mistral-large-2512"],
  limits: { contextWindow: 262144, maxOutputTokens: 8192, verification: "conservative" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.mistral.ai/models/mistral-large-3-25-12"], notes: "256K context verified; hosted maximum output not separately published. This adapter does not add reasoning effort for Large 3." } } satisfies MistralModelInput);
