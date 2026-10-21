// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "meta/muse-spark-1.3-contributor",
  "displayName": "Meta: Muse Spark 1.3 Contributor",
  "limits": {
    "contextWindow": 1048576,
    "maxOutputTokens": 943718,
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
      "https://openrouter.ai/api/v1/models/meta/muse-spark-1.3-contributor/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "34ebbcd418fd5356cd743c8a045e8d098644f5191a3369786d2d232544adbcab"
  },
  "apiModelId": "meta/muse-spark-1.3-contributor",
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
