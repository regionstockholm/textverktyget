import { defineModel } from "../../../validation.js";
import type { AzureModelInput } from "../types.js";
export default defineModel({
  provider: "azure", id: "gpt-5.4", apiModelId: "", deploymentRequired: true, displayName: "GPT-5.4 (Azure deployment profile)",
  limits: { contextWindow: 1050000, maxInputTokens: 922000, maxOutputTokens: 128000, verification: "deployment-dependent" },
  reasoning: { mode: "effort", enabledEffort: "low", disabledEffort: "none", canDisable: true }, outputTokenParameter: "max_completion_tokens",
  temperature: "unsupported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models"], notes: "Chat Completions deployment profile; region/access/API-version requirements remain installation-specific. Shared context budget includes reasoning output." },
} satisfies AzureModelInput);
