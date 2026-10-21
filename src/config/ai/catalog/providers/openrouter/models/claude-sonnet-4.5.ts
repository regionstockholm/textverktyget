import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  provider: "openrouter", id: "anthropic/claude-sonnet-4.5", displayName: "Claude Sonnet 4.5 (OpenRouter)",
  limits: { contextWindow: 200000, maxOutputTokens: 64000, verification: "deployment-dependent" },
  reasoning: { mode: "openrouter", canDisable: true }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://openrouter.ai/api/v1/models/anthropic/claude-sonnet-4.5/endpoints"], notes: "Endpoint contexts differ (Azure 200K, others 1M); this profile uses the common lower limit. Lifecycle is route-specific and is not inferred from the direct Anthropic API." },
} satisfies OpenrouterModelInput);
