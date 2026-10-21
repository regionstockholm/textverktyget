// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenaiModelInput } from "../types.js";
export default defineModel({
  "provider": "openai",
  "id": "o1-pro",
  "displayName": "o1-pro",
  "limits": {
    "contextWindow": 200000,
    "maxOutputTokens": 100000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "effort",
    "enabledEffort": "low",
    "disabledEffort": "low",
    "canDisable": false
  },
  "temperature": "unsupported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://developers.openai.com/api/docs/models/o1-pro.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "28c725c01a25087e79a0230fb5fc3a60aa736794a2d298ef677714ef03475397"
  },
  "outputTokenParameter": "max_completion_tokens",
  "apiStyle": "responses",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "o1-pro",
  "aliases": [],
  "webSearch": false,
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies OpenaiModelInput);
