import { defineModel } from "../../../validation.js";
import type { OpenaiModelInput } from "../types.js";
export default defineModel({ provider: "openai", id: "gpt-4.1-mini", displayName: "GPT-4.1 Mini", aliases: ["gpt-4.1-mini-2025-04-14"],
  limits: { contextWindow: 1047576, maxOutputTokens: 32768, verification: "verified" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://developers.openai.com/api/docs/models/gpt-4.1-mini"], notes: "Non-reasoning text-generation model; no automatic web-search capability on Chat Completions." } } satisfies OpenaiModelInput);
