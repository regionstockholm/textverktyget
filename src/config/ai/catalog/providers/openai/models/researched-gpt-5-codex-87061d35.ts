// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { OpenaiModelInput } from "../types.js";
export default defineModel({
  "provider": "openai",
  "id": "gpt-5-codex",
  "displayName": "GPT-5-Codex",
  "limits": {
    "contextWindow": 400000,
    "maxOutputTokens": 128000,
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
      "https://developers.openai.com/api/docs/models/gpt-5-codex.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "9b03c760121fc5ae2ce20cb85cd4a846feb7f4e04514a5920ae7f3cf36e5685a"
  },
  "outputTokenParameter": "max_completion_tokens",
  "apiStyle": "responses",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "gpt-5-codex",
  "aliases": [],
  "webSearch": false,
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies OpenaiModelInput);
