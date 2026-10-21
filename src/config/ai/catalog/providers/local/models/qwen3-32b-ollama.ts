import { defineModel } from "../../../validation.js";
import type { LocalModelInput } from "../types.js";
export default defineModel({
  provider: "local", id: "qwen3-32b-ollama", apiModelId: "qwen3:32b", displayName: "Qwen3 32B (Ollama)",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "deployment-dependent" },
  reasoning: { mode: "effort", enabledEffort: "low", disabledEffort: "none", canDisable: true }, temperature: "supported", structuredOutput: "json-object", status: "active", defaults: { temperature: 0.6 },
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.ollama.com/openai", "https://huggingface.co/Qwen/Qwen3-32B"], notes: "Ollama's reasoning_effort maps to boolean thinking on this model. Native model context is 32768; the actual local num_ctx may be smaller, so the starting profile uses 8192/4096. Configure server and profile together." },
} satisfies LocalModelInput);
