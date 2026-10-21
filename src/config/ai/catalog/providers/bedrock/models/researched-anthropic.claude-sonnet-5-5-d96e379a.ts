// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { BedrockModelInput } from "../types.js";
export default defineModel({
  "provider": "bedrock",
  "id": "anthropic.claude-sonnet-5-5",
  "displayName": "Claude Sonnet 5.5",
  "limits": {
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "anthropic-adaptive",
    "enabledEffort": "medium",
    "canDisable": true
  },
  "temperature": "without-reasoning",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-05",
    "revision": 1,
    "sources": [
      "https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "42e9ba90b28ff5975eb5856f56ceabc6613eca48e33d990cf8346d902ee88186"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "anthropic.claude-sonnet-5-5",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies BedrockModelInput);
