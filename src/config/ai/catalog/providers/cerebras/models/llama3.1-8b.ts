import { defineModel } from "../../../validation.js";
import type { CerebrasModelInput } from "../types.js";
export default defineModel({
  provider: "cerebras", id: "llama3.1-8b", displayName: "Llama 3.1 8B (deprecated)",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "deprecated",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://inference-docs.cerebras.ai/support/deprecation", "https://inference-docs.cerebras.ai/models/overview"], notes: "Deprecated May 27, 2026 and absent from Shared Inference catalog. Retained for existing/dedicated installations; select GPT OSS for new Shared Inference use." },
} satisfies CerebrasModelInput);
