// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  "provider": "fireworks",
  "id": "accounts/fireworks/models/qwen3-30b-a3b",
  "displayName": "accounts/fireworks/models/qwen3-30b-a3b",
  "limits": {
    "contextWindow": 32768,
    "maxOutputTokens": 32768,
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
      "https://fireworks.ai/models/fireworks/qwen3-30b-a3b"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. This source marks serverless inference unavailable; enter an actual dedicated deployment model ID before use.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "93ef9be5679f1daace1b8a2dce1cd8a12798200429373840af4d6f28ddbd0030"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "deploymentRequired": true,
  "apiModelId": "accounts/fireworks/models/qwen3-30b-a3b",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies FireworksModelInput);
