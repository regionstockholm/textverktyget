// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "qwen/qwen3-next-80b-a3b-thinking",
  "displayName": "Qwen: Qwen3 Next 80B A3B Thinking",
  "limits": {
    "contextWindow": 131072,
    "maxOutputTokens": 32768,
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
      "https://openrouter.ai/api/v1/models/qwen/qwen3-next-80b-a3b-thinking/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "d1ac4f1d882961876f8a18d43b8bf1d8b345358265b00ebacdee5fecd94b0de5"
  },
  "apiModelId": "qwen/qwen3-next-80b-a3b-thinking",
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
