import { defineModel } from "../../../validation.js";
import type { LocalModelInput } from "../types.js";
export default defineModel({
  provider: "local", id: "generic-local", apiModelId: "", deploymentRequired: true, displayName: "Generic local text model (enter installed ID)",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "deployment-dependent" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.ollama.com/openai"], notes: "Conservative compatibility profile. Actual context must match server configuration. Register a custom JSON model profile for higher output limits or model-specific reasoning controls." },
} satisfies LocalModelInput);
