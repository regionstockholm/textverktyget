// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  "provider": "vertex",
  "id": "multilingual-e5-small-maas",
  "displayName": "multilingual-e5-small-maas",
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
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/e5/multilingual-e5-small"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. Exact Vertex serving model ID/invocation protocol requires deployment review.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "9a4a923f4432c3a37456ff92c713fe414466e5818d18a7f6ba2060575b89fb71"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "pending",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "multilingual-e5-small-maas",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies VertexModelInput);
