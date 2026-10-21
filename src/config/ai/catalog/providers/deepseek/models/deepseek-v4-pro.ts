import { defineModel } from "../../../validation.js";
import type { DeepseekModelInput } from "../types.js";
export default defineModel({ provider: "deepseek", id: "deepseek-v4-pro", displayName: "DeepSeek V4 Pro",
  limits: { contextWindow: 1000000, maxOutputTokens: 384000, verification: "conservative" }, reasoning: { mode: "thinking-toggle" }, temperature: "without-reasoning", structuredOutput: "json-object", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://api-docs.deepseek.com/quick_start/pricing", "https://api-docs.deepseek.com/guides/thinking_mode"], notes: "Provider confirms continued Pro service. Published rounded 1M/384K limits interpreted conservatively; thinking output consumes output tokens." } } satisfies DeepseekModelInput);
