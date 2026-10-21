import { defineModel } from "../../../validation.js";
import type { MistralModelInput } from "../types.js";
export default defineModel({ provider: "mistral", id: "mistral-medium-3-5", displayName: "Mistral Medium 3.5",
  limits: { contextWindow: 262144, maxOutputTokens: 8192, verification: "conservative" }, reasoning: { mode: "effort", enabledEffort: "high", disabledEffort: "none", canDisable: true },
  temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.mistral.ai/studio/conversations/reasoning.md", "https://huggingface.co/mistralai/Mistral-Medium-3.5-128B"], notes: "256K context verified against publisher model card. Hosted output ceiling not specified; conservative 8192 output budget. High/none effort verified in official API guide." } } satisfies MistralModelInput);
