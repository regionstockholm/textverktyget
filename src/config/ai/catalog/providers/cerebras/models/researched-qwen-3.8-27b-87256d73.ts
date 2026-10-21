// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { CerebrasModelInput } from "../types.js";
export default defineModel({
  "provider": "cerebras",
  "id": "qwen-3.8-27b",
  "displayName": "Qwen 3.8 27B",
  "limits": {
    "contextWindow": 64000,
    "maxOutputTokens": 32000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "effort",
    "enabledEffort": "low",
    "disabledEffort": "none",
    "canDisable": true
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://inference-docs.cerebras.ai/models/qwen-3.8-27b"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "896e4d478292fffade11c97572021a83e3ef7142c75d6c5e063fa0f9f2b6c6ae"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "qwen-3.8-27b",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies CerebrasModelInput);
