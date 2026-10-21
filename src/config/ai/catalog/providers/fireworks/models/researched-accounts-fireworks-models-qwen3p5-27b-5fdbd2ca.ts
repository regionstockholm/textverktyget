// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  "provider": "fireworks",
  "id": "accounts/fireworks/models/qwen3p5-27b",
  "displayName": "accounts/fireworks/models/qwen3p5-27b",
  "limits": {
    "contextWindow": 262000,
    "maxOutputTokens": 4096,
    "verification": "deployment-dependent"
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
      "https://fireworks.ai/models/fireworks/qwen3p5-27b"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. This source marks serverless inference unavailable; enter an actual dedicated deployment model ID before use.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "a36d3e41d8ef05dd820d6291a96a91d823fabb6f8145e10e9b94a7de4d89050c"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "deploymentRequired": true,
  "apiModelId": "accounts/fireworks/models/qwen3p5-27b",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies FireworksModelInput);
