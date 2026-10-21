import { defineModel } from "../../../validation.js";
import type { MistralModelInput } from "../types.js";
export default defineModel({ provider: "mistral", id: "mistral-small-latest", displayName: "Mistral Small 4 (latest alias)", aliases: ["mistral-small-2603"],
  limits: { contextWindow: 262144, maxOutputTokens: 8192, verification: "conservative" }, reasoning: { mode: "effort", enabledEffort: "high", disabledEffort: "none", canDisable: true },
  temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.mistral.ai/models/mistral-small-4-0-26-03", "https://docs.mistral.ai/studio/conversations/reasoning.md"], notes: "256K context and high/none effort verified. A separate hosted output ceiling was not published on the reviewed page; 8192 is a conservative application ceiling, not the model maximum. Latest alias can move." } } satisfies MistralModelInput);
