// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { AzureModelInput } from "../types.js";
export default defineModel({
  "provider": "azure",
  "id": "gpt-6-luna",
  "displayName": "gpt-6-luna",
  "limits": {
    "contextWindow": 1050000,
    "maxOutputTokens": 128000,
    "verification": "deployment-dependent",
    "maxInputTokens": 1050000
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
      "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "92c503a2389e7aec9cab002f49532302c4a92f21f31021c95b58cb5c7eb49c6e"
  },
  "outputTokenParameter": "max_completion_tokens",
  "apiStyle": "azure-v1-chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "",
  "deploymentRequired": true,
  "aliases": [],
  "webSearch": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies AzureModelInput);
