// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { BedrockModelInput } from "../types.js";
export default defineModel({
  "provider": "bedrock",
  "id": "anthropic.claude-fable-5",
  "displayName": "Claude Fable 5",
  "limits": {
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "anthropic-adaptive",
    "enabledEffort": "medium",
    "canDisable": false
  },
  "temperature": "without-reasoning",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-05",
    "revision": 1,
    "sources": [
      "https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-fable-5.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "ff3cfb9d4b7296836a1abfd0e8d7cf79e8f158ab724709cb6e18a2ee1010812f"
  },
  "apiStyle": "bedrock-invoke",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "anthropic.claude-fable-5",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies BedrockModelInput);
