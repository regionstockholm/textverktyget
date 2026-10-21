import { defineModel } from "../../../validation.js";
import type { XaiModelInput } from "../types.js";
export default defineModel({ provider: "xai", id: "grok-4.7", displayName: "Grok 4.7",
  limits: { contextWindow: 500000, maxOutputTokens: 4096, verification: "conservative" }, reasoning: { mode: "effort", enabledEffort: "low", disabledEffort: "low", canDisable: false }, temperature: "unsupported", structuredOutput: "json-schema", status: "active",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.x.ai/developers/models/grok-4.7"], notes: "500K context and low/medium/high/xhigh effort verified; no none level. Output ceiling not stated in the model page, so this profile caps output conservatively at 4096." } } satisfies XaiModelInput);
