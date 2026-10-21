// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  "provider": "fireworks",
  "id": "accounts/deepseek-ai/models/deepseek-v4-flash-vision-exp",
  "displayName": "accounts/deepseek-ai/models/deepseek-v4-flash-vision-exp",
  "limits": {
    "contextWindow": 1040000,
    "maxOutputTokens": 4096,
    "verification": "deployment-dependent"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "preview",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://fireworks.ai/models/deepseek-ai/deepseek-v4-flash-vision-exp"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. This source marks serverless inference unavailable; enter an actual dedicated deployment model ID before use.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "079d548b6c86999ea03726d70e8139ffe887a4abc419a228a1b6f1678e93a018"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "deploymentRequired": true,
  "apiModelId": "accounts/deepseek-ai/models/deepseek-v4-flash-vision-exp",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies FireworksModelInput);
