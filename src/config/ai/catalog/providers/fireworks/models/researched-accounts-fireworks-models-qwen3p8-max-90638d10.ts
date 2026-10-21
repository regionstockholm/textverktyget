// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  "provider": "fireworks",
  "id": "accounts/fireworks/models/qwen3p8-max",
  "displayName": "accounts/fireworks/models/qwen3p8-max",
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
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://fireworks.ai/models/fireworks/qwen3p8-max"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "7e937ed2b5bb5d63698795e8348a3268b9486003106268cc5da2a9804546f50a"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "accounts/fireworks/models/qwen3p8-max",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies FireworksModelInput);
