import { defineModel } from "../../../validation.js";
import type { GroqModelInput } from "../types.js";
export default defineModel({
  provider: "groq", id: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B (Groq)",
  limits: { contextWindow: 131072, maxOutputTokens: 32768, verification: "verified" },
  reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-object", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://console.groq.com/docs/models"], notes: "Current catalog labels this an enterprise model. Access depends on the account. Dedicated reasoning mode is not supported." },
} satisfies GroqModelInput);
