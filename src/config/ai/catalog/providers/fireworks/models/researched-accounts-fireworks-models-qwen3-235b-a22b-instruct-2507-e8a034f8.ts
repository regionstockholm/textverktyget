// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  "provider": "fireworks",
  "id": "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
  "displayName": "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
  "limits": {
    "contextWindow": 262144,
    "maxOutputTokens": 16384,
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
      "https://fireworks.ai/models/fireworks/qwen3-235b-a22b-instruct-2507"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. This source marks serverless inference unavailable; enter an actual dedicated deployment model ID before use.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "b60eac0d43454b71a2675659e7bca4e43a61e51a032462201dd3210870bb2739"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "deploymentRequired": true,
  "apiModelId": "accounts/fireworks/models/qwen3-235b-a22b-instruct-2507",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies FireworksModelInput);
