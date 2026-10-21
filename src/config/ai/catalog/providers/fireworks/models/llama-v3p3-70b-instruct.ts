import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  provider: "fireworks", id: "accounts/fireworks/models/llama-v3p3-70b-instruct", displayName: "Llama 3.3 70B (Fireworks)",
  limits: { contextWindow: 131072, maxOutputTokens: 4096, verification: "deployment-dependent" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://fireworks.ai/models/fireworks/llama-v3p3-70b-instruct"], notes: "Model page identifies on-demand deployment and says Serverless Not supported, while FAQ differs. Requires account/deployment testing. Context verified; output ceiling conservatively 4096." },
} satisfies FireworksModelInput);
