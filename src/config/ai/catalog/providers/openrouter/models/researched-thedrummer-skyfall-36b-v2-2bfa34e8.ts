// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "thedrummer/skyfall-36b-v2",
  "displayName": "TheDrummer: Skyfall 36B V2",
  "limits": {
    "contextWindow": 32768,
    "maxOutputTokens": 29491,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "supported",
  "structuredOutput": "json-schema",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/thedrummer/skyfall-36b-v2/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "bbe078fe53eea42c387e865e4150c52866e06164a66d397e06cae697e1030e44"
  },
  "apiModelId": "thedrummer/skyfall-36b-v2",
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
