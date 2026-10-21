// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  "provider": "fireworks",
  "id": "accounts/fireworks/models/qwen2p5-coder-0p5b",
  "displayName": "accounts/fireworks/models/qwen2p5-coder-0p5b",
  "limits": {
    "contextWindow": 32700,
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
      "https://fireworks.ai/models/fireworks/qwen2p5-coder-0p5b"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. This source marks serverless inference unavailable; enter an actual dedicated deployment model ID before use.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "06d24f259b515e47d125e9af66ebffd7479b39ede39ff0dae7167f6c1f4f3a32"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "deploymentRequired": true,
  "apiModelId": "accounts/fireworks/models/qwen2p5-coder-0p5b",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies FireworksModelInput);
