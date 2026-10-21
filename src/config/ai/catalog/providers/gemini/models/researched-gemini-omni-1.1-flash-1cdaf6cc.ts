// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { GeminiModelInput } from "../types.js";
export default defineModel({
  "provider": "gemini",
  "id": "gemini-omni-1.1-flash",
  "displayName": "Gemini Omni 1.1 Flash",
  "limits": {
    "contextWindow": 131072,
    "maxOutputTokens": 65536,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://generativelanguage.googleapis.com/v1beta/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. The model-list API supplied identity but no per-model request specification.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "add7e228ebaac2430f1d53c206623bd8b341e21b8b721b32eccf427ee4a8d9b5"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "pending",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "gemini-omni-1.1-flash",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies GeminiModelInput);
