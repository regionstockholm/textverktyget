// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  "provider": "vertex",
  "id": "llama-4-maverick-17b-128e-instruct-maas",
  "displayName": "llama-4-maverick-17b-128e-instruct-maas",
  "limits": {
    "contextWindow": 524288,
    "maxOutputTokens": 8192,
    "verification": "verified"
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
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/llama/llama4-maverick"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested. Exact Vertex serving model ID/invocation protocol requires deployment review.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "9115f4f0ad3462f7b1eb93f9d0cda5d63c6348d18a224b867e9c9f18b304801c"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "pending",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "llama-4-maverick-17b-128e-instruct-maas",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies VertexModelInput);
