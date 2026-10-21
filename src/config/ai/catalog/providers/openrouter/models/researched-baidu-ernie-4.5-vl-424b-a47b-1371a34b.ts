// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "baidu/ernie-4.5-vl-424b-a47b",
  "displayName": "Baidu: ERNIE 4.5 VL 424B A47B ",
  "limits": {
    "contextWindow": 123000,
    "maxOutputTokens": 16000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "openrouter",
    "canDisable": true
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/baidu/ernie-4.5-vl-424b-a47b/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "c3ed3025465be40f30991b6d0e576a1513b69eec60114a8fd18a1f9590591610"
  },
  "apiModelId": "baidu/ernie-4.5-vl-424b-a47b",
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
