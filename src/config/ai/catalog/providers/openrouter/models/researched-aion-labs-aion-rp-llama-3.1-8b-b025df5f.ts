// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "aion-labs/aion-rp-llama-3.1-8b",
  "displayName": "AionLabs: Aion-RP 1.0 (8B)",
  "limits": {
    "contextWindow": 32768,
    "maxOutputTokens": 29491,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/aion-labs/aion-rp-llama-3.1-8b/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "275bf18288bfedf1bd4cdfa6ca4fb0dbf87ca9d7777559bd535c76418039e801"
  },
  "apiModelId": "aion-labs/aion-rp-llama-3.1-8b",
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
