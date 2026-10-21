// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "rekaai/reka-flash-3",
  "displayName": "Reka Flash 3",
  "limits": {
    "contextWindow": 65536,
    "maxOutputTokens": 58982,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "openrouter",
    "canDisable": false
  },
  "temperature": "supported",
  "structuredOutput": "json-schema",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/rekaai/reka-flash-3/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "ad84e4bfa316cbb8e05521a11477352d2a520dc933fc39e7938d7be6bb77e3ac"
  },
  "apiModelId": "rekaai/reka-flash-3",
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
