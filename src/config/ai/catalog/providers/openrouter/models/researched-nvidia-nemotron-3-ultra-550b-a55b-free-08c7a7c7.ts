// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
  "displayName": "NVIDIA: Nemotron 3 Ultra (free)",
  "limits": {
    "contextWindow": 1000000,
    "maxOutputTokens": 65536,
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
      "https://openrouter.ai/api/v1/models/nvidia/nemotron-3-ultra-550b-a55b%3Afree/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "369c43ef25732e1dab3b433c21bb820d3bdcc75ed3de616c7c64ff20648a97a7"
  },
  "apiModelId": "nvidia/nemotron-3-ultra-550b-a55b:free",
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
