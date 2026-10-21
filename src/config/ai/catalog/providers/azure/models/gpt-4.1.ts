import { defineModel } from "../../../validation.js";
import type { AzureModelInput } from "../types.js";
export default defineModel({
  provider: "azure", id: "gpt-4.1", apiModelId: "", deploymentRequired: true, displayName: "GPT-4.1 (Azure deployment profile)",
  limits: { contextWindow: 128000, maxOutputTokens: 32768, verification: "deployment-dependent" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models"], notes: "Provisioned/batch deployments use 128K; standard deployments can support 300K or larger limits. Default uses lower deployment limit; configure actual context for your deployment." },
} satisfies AzureModelInput);
