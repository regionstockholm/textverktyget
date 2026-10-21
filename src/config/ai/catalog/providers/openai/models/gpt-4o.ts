import { defineModel } from "../../../validation.js";
import type { OpenaiModelInput } from "../types.js";
export default defineModel({ provider: "openai", id: "gpt-4o", displayName: "GPT-4o", aliases: ["gpt-4o-2024-08-06", "gpt-4o-2024-11-20"],
  limits: { contextWindow: 128000, maxOutputTokens: 16384, verification: "verified" }, reasoning: { mode: "none" }, temperature: "supported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://developers.openai.com/api/docs/models/gpt-4o"], notes: "The earlier May 2024 snapshot has a different output ceiling and is intentionally not an alias here. Web search requires a different endpoint/tool integration." } } satisfies OpenaiModelInput);
