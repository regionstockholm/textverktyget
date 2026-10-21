import { defineModel } from "../../../validation.js";
import type { XaiModelInput } from "../types.js";
export default defineModel({ provider: "xai", id: "grok-3-mini", displayName: "Grok 3 Mini (legacy)",
  limits: { contextWindow: 8192, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "effort", enabledEffort: "low", disabledEffort: "low", canDisable: false }, temperature: "unsupported", structuredOutput: "prompt", status: "deprecated",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.x.ai/developers/models"], notes: "No current model page; conservative legacy profile. Reasoning cannot be disabled; low effort preserves the earlier adapter behavior." } } satisfies XaiModelInput);
