import { defineModel } from "../../../validation.js";
import type { TogetherModelInput } from "../types.js";
export default defineModel({
  provider: "together", id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", displayName: "Llama 3.3 70B Instruct Turbo",
  limits: { contextWindow: 131072, maxOutputTokens: 4096, verification: "conservative" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.together.ai/docs/serverless-models"], notes: "Context and structured output verified in serverless catalog. Maximum output not listed; 4096 is an application ceiling pending a hosted limit confirmation." },
} satisfies TogetherModelInput);
