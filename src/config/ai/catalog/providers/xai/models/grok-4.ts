import { defineModel } from "../../../validation.js";
import type { XaiModelInput } from "../types.js";
export default defineModel({ provider: "xai", id: "grok-4", displayName: "Grok 4 (legacy)",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "always-on" }, temperature: "unsupported", structuredOutput: "prompt", status: "deprecated",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.x.ai/developers/models"], notes: "Legacy model page returned 404 and ID is absent from current lineup. Retained for saved configurations; availability and token ceilings require confirmation." } } satisfies XaiModelInput);
