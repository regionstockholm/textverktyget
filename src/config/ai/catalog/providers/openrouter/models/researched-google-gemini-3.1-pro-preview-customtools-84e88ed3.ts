// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenrouterModelInput } from "../types.js";
export default defineModel({
  "provider": "openrouter",
  "id": "google/gemini-3.1-pro-preview-customtools",
  "displayName": "Google: Gemini 3.1 Pro Preview Custom Tools",
  "limits": {
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "openrouter",
    "canDisable": false
  },
  "temperature": "supported",
  "structuredOutput": "json-schema",
  "status": "preview",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://openrouter.ai/api/v1/models/google/gemini-3.1-pro-preview-customtools/endpoints",
      "https://openrouter.ai/api/v1/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Endpoint metadata reviewed; the lower currently active serving ceilings are used where supplied.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "1a03167c47c2c7b53184f92f16419c990d3ab09996c53d99833e473b7701c493"
  },
  "apiModelId": "google/gemini-3.1-pro-preview-customtools",
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
