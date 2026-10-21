import { defineModel } from "../../../validation.js";
import type { AzureModelInput } from "../types.js";
export default defineModel({
  provider: "azure", id: "gpt-4o", apiModelId: "", deploymentRequired: true, displayName: "GPT-4o (Azure deployment profile)",
  limits: { contextWindow: 128000, maxOutputTokens: 16384, verification: "deployment-dependent" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models"], notes: "Enter your deployment name separately. Profile assumes August/November 2024 model version; May 2024 output limit is 4096 and needs its own profile." },
} satisfies AzureModelInput);
