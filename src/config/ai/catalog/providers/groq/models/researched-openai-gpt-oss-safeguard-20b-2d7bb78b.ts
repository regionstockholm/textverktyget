// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { GroqModelInput } from "../types.js";
export default defineModel({
  "provider": "groq",
  "id": "openai/gpt-oss-safeguard-20b",
  "displayName": "openai/gpt-oss-safeguard-20b",
  "limits": {
    "contextWindow": 131072,
    "maxOutputTokens": 4096,
    "verification": "conservative"
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
      "https://huggingface.co/api/models/openai/gpt-oss-safeguard-20b?expand=inferenceProviderMapping"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. Current serving route and native API ID confirmed by Hugging Face's official Groq mapping; direct Groq documentation returned HTTP 403.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "983a5d4a22b4319ed13205b0db1ccbeb87cc3b2a4ababbeef2a8630b29314045"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "openai/gpt-oss-safeguard-20b",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies GroqModelInput);
