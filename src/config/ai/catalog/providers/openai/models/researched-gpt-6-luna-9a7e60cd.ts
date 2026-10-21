// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenaiModelInput } from "../types.js";
export default defineModel({
  "provider": "openai",
  "id": "gpt-6-luna",
  "displayName": "GPT-6 Luna",
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
      "https://developers.openai.com/api/docs/models/gpt-6-luna.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "9bde4b64e369ace4696d98a7dd6ec8b8e0c6a8de090a116970d55dcd4cadfc7b"
  },
  "outputTokenParameter": "max_completion_tokens",
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "gpt-6-luna",
  "aliases": [],
  "webSearch": false,
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies OpenaiModelInput);
