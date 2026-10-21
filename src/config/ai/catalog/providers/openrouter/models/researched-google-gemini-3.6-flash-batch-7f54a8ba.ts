// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "google/gemini-3.6-flash:batch",
  "displayName": "Google: Gemini 3.6 Flash (batch)",
  "limits": {
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "openrouter",
    "canDisable": false
  },
  "temperature": "unsupported",
  "structuredOutput": "json-schema",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/google/gemini-3.6-flash%3Abatch/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "209be53fd70822d381e036d9155143eff6548d88a5b1dd257a049695c88c8560"
  },
  "apiModelId": "google/gemini-3.6-flash:batch",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "apiStyle": "chat",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies OpenrouterModelInput);
