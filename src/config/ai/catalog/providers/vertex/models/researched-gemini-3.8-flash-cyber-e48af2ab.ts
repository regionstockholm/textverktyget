// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  "provider": "vertex",
  "id": "gemini-3.8-flash-cyber",
  "displayName": "gemini-3.8-flash-cyber",
  "limits": {
    "contextWindow": 1048576,
    "maxOutputTokens": 65536,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "gemini-level",
    "enabledLevel": "low",
    "disabledLevel": "low",
    "canDisable": false
  },
  "temperature": "supported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash-cyber"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "140eba860435161cab8614a19779f64fb3658ea4240d82faf6d4f7e7a5468050"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "gemini-3.8-flash-cyber",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies VertexModelInput);
