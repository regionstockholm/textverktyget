// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  "provider": "vertex",
  "id": "deepseek-v3.2-maas",
  "displayName": "deepseek-v3.2-maas",
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
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/deepseek/deepseek-v32"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested. Exact Vertex serving model ID/invocation protocol requires deployment review.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "65c64d744dbaab7cc2af39651ac70c89e0f31f59d6195117089522e39e5ebffa"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "pending",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "deepseek-v3.2-maas",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies VertexModelInput);
