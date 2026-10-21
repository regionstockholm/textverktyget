// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "relace/relace-apply-3",
  "displayName": "Relace: Relace Apply 3",
  "limits": {
    "contextWindow": 256000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "unsupported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/relace/relace-apply-3/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "df4db67a2ce8e88a7a74c25c5547fcef33592d561d29a4b7a28dfadad042ae8c"
  },
  "apiModelId": "relace/relace-apply-3",
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
