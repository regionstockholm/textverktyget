// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { MistralModelInput } from "../types.js";
export default defineModel({
  "provider": "mistral",
  "id": "ministral-3b-2410",
  "displayName": "ministral-3b-2410",
  "limits": {
    "contextWindow": 8192,
    "maxOutputTokens": 4096,
    "verification": "conservative"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "deprecated",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://docs.mistral.ai/models/ministral-3b-24-1"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "43abb6afae5227fa3d39a5c23fdcf54e609100fc88b18dbd97945b3401de0cb0"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "ministral-3b-2410",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies MistralModelInput);
