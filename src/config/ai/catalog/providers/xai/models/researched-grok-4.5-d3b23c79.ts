// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { XaiModelInput } from "../types.js";
export default defineModel({
  "provider": "xai",
  "id": "grok-4.5",
  "displayName": "grok-4.5",
  "limits": {
    "contextWindow": 500000,
    "maxOutputTokens": 4096,
    "verification": "conservative"
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
      "https://docs.x.ai/developers/models"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "10bb96ececf67ebe4a8d755fe9bfb8551efde2b65c2b99bb8896f6425fa412ba"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "grok-4.5",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies XaiModelInput);
