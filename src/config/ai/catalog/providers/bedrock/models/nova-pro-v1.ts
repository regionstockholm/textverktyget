import { defineModel } from "../../../validation.js";
import type { BedrockModelInput } from "../types.js";
export default defineModel({
  provider: "bedrock", id: "amazon.nova-pro-v1:0", displayName: "Amazon Nova Pro v1", aliases: ["us.amazon.nova-pro-v1:0", "eu.amazon.nova-pro-v1:0", "apac.amazon.nova-pro-v1:0"],
  limits: { contextWindow: 300000, maxOutputTokens: 10000, verification: "verified" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "prompt", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html"], notes: "Nova v1, not Nova 2 reasoning models. Region and inference-profile availability must be checked for the AWS account. Prompt-based JSON evaluation on Converse." },
} satisfies BedrockModelInput);
