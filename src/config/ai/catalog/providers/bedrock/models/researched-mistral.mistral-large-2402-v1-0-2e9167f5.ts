// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { BedrockModelInput } from "../types.js";
export default defineModel({
  "provider": "bedrock",
  "id": "mistral.mistral-large-2402-v1:0",
  "displayName": "Mistral Large",
  "limits": {
    "contextWindow": 32000,
    "maxOutputTokens": 4000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-05",
    "revision": 1,
    "sources": [
      "https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-mistral-ai-mistral-large.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "971a47c456f0192c173fff14a25b244ca4658ec8a65e21ee708af2a40003b5fd"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "mistral.mistral-large-2402-v1:0",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies BedrockModelInput);
