// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenaiModelInput } from "../types.js";
export default defineModel({
  "provider": "openai",
  "id": "gpt-5.5",
  "displayName": "GPT-5.5",
  "limits": {
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "effort",
    "enabledEffort": "low",
    "disabledEffort": "none",
    "canDisable": true
  },
  "temperature": "unsupported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://developers.openai.com/api/docs/models/gpt-5.5.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "fdb0fc8fe9ea7f276716c2a5b49b902e7e676ff262bb8adfdf2d5b8911bad3ba"
  },
  "outputTokenParameter": "max_completion_tokens",
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "gpt-5.5",
  "aliases": [],
  "webSearch": false,
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies OpenaiModelInput);
