// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { BedrockModelInput } from "../types.js";
export default defineModel({
  "provider": "bedrock",
  "id": "anthropic.claude-opus-4-8",
  "displayName": "Claude Opus 4.8",
  "limits": {
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "anthropic-budget",
    "minimumBudget": 1024,
    "defaultBudget": 8192,
    "canDisable": true
  },
  "temperature": "without-reasoning",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-05",
    "revision": 1,
    "sources": [
      "https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-opus-4-8.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "f3955c10352c69df69755deb0e9b4423bfd12b69e897f29a436a30f478b60f8d"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "anthropic.claude-opus-4-8",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies BedrockModelInput);
