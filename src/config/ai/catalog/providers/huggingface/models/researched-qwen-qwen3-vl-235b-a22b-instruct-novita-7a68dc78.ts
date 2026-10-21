// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { HuggingfaceModelInput } from "../types.js";
export default defineModel({
  "provider": "huggingface",
  "id": "Qwen/Qwen3-VL-235B-A22B-Instruct:novita",
  "displayName": "Qwen/Qwen3-VL-235B-A22B-Instruct (novita)",
  "limits": {
    "contextWindow": 131072,
    "maxOutputTokens": 4096,
    "verification": "deployment-dependent"
  },
  "reasoning": {
    "mode": "none"
  },
  "temperature": "supported",
  "structuredOutput": "json-schema",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://router.huggingface.co/v1/models"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. Explicit novita serving route; published context retained, unpublished output capped conservatively.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "0d346155849302ab6881350af3465ee247f7eb26899a41fdcd8bc0c9bca71291"
  },
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "Qwen/Qwen3-VL-235B-A22B-Instruct:novita",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "apiStyle": "chat",
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies HuggingfaceModelInput);
