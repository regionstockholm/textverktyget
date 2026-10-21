import { defineModel } from "../../../validation.js";
import type { DeepseekModelInput } from "../types.js";
export default defineModel({ provider: "deepseek", id: "deepseek-flash", displayName: "DeepSeek V4.1 Flash", aliases: ["deepseek-v4-flash", "deepseek-v4-flash-vision-exp"],
  limits: { contextWindow: 1000000, maxOutputTokens: 384000, verification: "conservative" }, reasoning: { mode: "thinking-toggle" }, temperature: "without-reasoning", structuredOutput: "json-object", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://api-docs.deepseek.com/quick_start/pricing", "https://api-docs.deepseek.com/guides/thinking_mode", "https://api-docs.deepseek.com/updates"], notes: "Official limits are written 1M/384K; decimal values used conservatively. Thinking uses an explicit enabled/disabled toggle. Old V4 Flash aliases are routed to V4.1 by the provider." } } satisfies DeepseekModelInput);
