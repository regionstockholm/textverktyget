// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { AzureModelInput } from "../types.js";
export default defineModel({
  "provider": "azure",
  "id": "westus3",
  "displayName": "westus3",
  "limits": {
    "contextWindow": 8192,
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
      "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. Foundry partner model needs a separate deployment API, not the Azure OpenAI adapter.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "92c503a2389e7aec9cab002f49532302c4a92f21f31021c95b58cb5c7eb49c6e"
  },
  "apiStyle": "azure-v1-chat",
  "readiness": {
    "adapter": "pending",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "",
  "deploymentRequired": true,
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies AzureModelInput);
