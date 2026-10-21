// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { FireworksModelInput } from "../types.js";
export default defineModel({
  "provider": "fireworks",
  "id": "accounts/sentientfoundation-serverless/models/dobby-mini-unhinged-plus-llama-3-1-8b",
  "displayName": "accounts/sentientfoundation-serverless/models/dobby-mini-unhinged-plus-llama-3-1-8b",
  "limits": {
    "contextWindow": 131000,
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
      "https://fireworks.ai/models/sentientfoundation-serverless/dobby-mini-unhinged-plus-llama-3-1-8b"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. This source marks serverless inference unavailable; enter an actual dedicated deployment model ID before use.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "32a8dd5a739e05b5c4e815bb1a119ebe6d82cab440d24ee43165645c64391625"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "deploymentRequired": true,
  "apiModelId": "accounts/sentientfoundation-serverless/models/dobby-mini-unhinged-plus-llama-3-1-8b",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies FireworksModelInput);
