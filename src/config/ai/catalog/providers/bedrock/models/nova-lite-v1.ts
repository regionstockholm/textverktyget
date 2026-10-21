import { defineModel } from "../../../validation.js";
import type { BedrockModelInput } from "../types.js";
export default defineModel({
  provider: "bedrock", id: "amazon.nova-lite-v1:0", displayName: "Amazon Nova Lite v1", aliases: ["us.amazon.nova-lite-v1:0", "eu.amazon.nova-lite-v1:0", "apac.amazon.nova-lite-v1:0"],
  limits: { contextWindow: 300000, maxOutputTokens: 10000, verification: "verified" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html"], notes: "Official Nova v1 table gives 300k context and 10k output. Generation uses Converse API, not partner model-specific Messages parameters." },
} satisfies BedrockModelInput);
