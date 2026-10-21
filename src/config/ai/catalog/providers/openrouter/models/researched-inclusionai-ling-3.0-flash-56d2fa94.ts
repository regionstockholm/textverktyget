// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "inclusionai/ling-3.0-flash",
  "displayName": "inclusionAI: Ling 3.0 Flash",
  "limits": {
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "openrouter",
    "canDisable": true
  },
  "temperature": "supported",
  "structuredOutput": "json-object",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/inclusionai/ling-3.0-flash/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "2b51c3d79b56436099ebdd9f865cda8ff30ae49df2a42bf14b4134093994b926"
  },
  "apiModelId": "inclusionai/ling-3.0-flash",
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
