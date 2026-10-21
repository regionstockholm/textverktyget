import { defineModel } from "../../../validation.js";
import type { GroqModelInput } from "../types.js";
export default defineModel({
  provider: "groq", id: "openai/gpt-oss-120b", displayName: "GPT OSS 120B (Groq)",
  limits: { contextWindow: 131072, maxOutputTokens: 65536, verification: "verified" },
  reasoning: { mode: "effort", enabledEffort: "low", disabledEffort: "low", canDisable: false },
  outputTokenParameter: "max_completion_tokens", temperature: "supported", structuredOutput: "json-schema", status: "active",
  nativeCapabilities: { webSearch: true },
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://console.groq.com/docs/models", "https://console.groq.com/docs/reasoning"], notes: "Reasoning supports low/medium/high, not none. Browser search requires tool orchestration, which this adapter does not enable." },
} satisfies GroqModelInput);
