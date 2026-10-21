// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "moonshotai/kimi-k3",
  "displayName": "MoonshotAI: Kimi K3",
  "limits": {
    "contextWindow": 250000,
    "maxOutputTokens": 16384,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "openrouter",
    "canDisable": true
  },
  "temperature": "supported",
  "structuredOutput": "json-schema",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/moonshotai/kimi-k3/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "3015876ed7977535952847c26990649ef93fbb31d9813ab0a8110b39437c88af"
  },
  "apiModelId": "moonshotai/kimi-k3",
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
