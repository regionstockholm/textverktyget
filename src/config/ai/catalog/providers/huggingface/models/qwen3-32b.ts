import { defineModel } from "../../../validation.js";
import type { HuggingfaceModelInput } from "../types.js";
export default defineModel({
  provider: "huggingface", id: "Qwen/Qwen3-32B", displayName: "Qwen3 32B (Hugging Face routing)",
  limits: { contextWindow: 32768, maxOutputTokens: 4096, verification: "deployment-dependent" },
  reasoning: { mode: "none" }, nativeCapabilities: { reasoning: true }, temperature: "supported", structuredOutput: "prompt", status: "active",
  defaults: { temperature: 0.6 },
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://huggingface.co/Qwen/Qwen3-32B", "https://huggingface.co/docs/inference-providers/tasks/chat-completion"], notes: "Native context 32768; 131072 requires YaRN. Hosted routes may differ. Native thinking is supported, but no route-independent hard thinking switch is assumed by this adapter. Output 4096 is conservative." },
} satisfies HuggingfaceModelInput);
