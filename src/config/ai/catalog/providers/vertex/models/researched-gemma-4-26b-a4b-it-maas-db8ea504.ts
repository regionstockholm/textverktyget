// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  "provider": "vertex",
  "id": "gemma-4-26b-a4b-it-maas",
  "displayName": "gemma-4-26b-a4b-it-maas",
  "limits": {
    "contextWindow": 8192,
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
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/google/gemma-4-26b-a4b-it"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. Exact Vertex serving model ID/invocation protocol requires deployment review.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "1f3fb24de2d8fac25dfaa3ca77843b56ce0b9aa05470e9f4deb35a853564bb0a"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "pending",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "gemma-4-26b-a4b-it-maas",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies VertexModelInput);
