// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { GeminiModelInput } from "../types.js";
export default defineModel({
  "provider": "gemini",
  "id": "gemini-3.8-flash",
  "displayName": "Gemini 3.8 Flash",
  "limits": {
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "gemini-level",
    "enabledLevel": "low",
    "disabledLevel": "low",
    "canDisable": false
  },
  "temperature": "supported",
  "structuredOutput": "json-schema",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-05",
    "revision": 2,
    "sources": [
      "https://github.com/google-gemini/cookbook/blob/main/quickstarts/Grounding.ipynb",
      "https://github.com/google-gemini/cookbook/blob/archive/generate-content-api/quickstarts/Grounding.ipynb",
      "https://generativelanguage.googleapis.com/v1beta/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. The model-list API supplied identity but no per-model request specification. Uses the documented Gemini 3 thinking-level API; low is selected and full disabling is not assumed. Live synthetic generation and quality JSON passed 2026-10-05T07:31:44.067Z; account access can differ between installations.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "add7e228ebaac2430f1d53c206623bd8b341e21b8b721b32eccf427ee4a8d9b5"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "specifications": "verified",
    "live": "passed"
  },
  "apiModelId": "gemini-3.8-flash",
  "aliases": [],
  "webSearch": true,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies GeminiModelInput);
