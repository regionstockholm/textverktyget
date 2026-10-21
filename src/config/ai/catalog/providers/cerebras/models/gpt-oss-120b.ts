import { defineModel } from "../../../validation.js";
import type { CerebrasModelInput } from "../types.js";
export default defineModel({
  provider: "cerebras", id: "gpt-oss-120b", displayName: "GPT OSS 120B (Cerebras, free-tier profile)",
  limits: { contextWindow: 65000, maxOutputTokens: 32000, verification: "deployment-dependent" },
  reasoning: { mode: "effort", enabledEffort: "low", disabledEffort: "low", canDisable: false },
  temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://inference-docs.cerebras.ai/models/openai-oss"], notes: "Published free limits 65k/32k, paid 131k/40k. Decimal free-tier limits used to avoid silently assuming a paid account; register a separate paid profile if required." },
} satisfies CerebrasModelInput);
