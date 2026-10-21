// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  "provider": "vertex",
  "id": "claude-sonnet-5",
  "displayName": "claude-sonnet-5",
  "limits": {
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "anthropic-budget",
    "minimumBudget": 1024,
    "defaultBudget": 8192,
    "canDisable": true
  },
  "temperature": "without-reasoning",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/claude/sonnet-5"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "512c42e88122c11869d79fb006808e40c81d9d0a3bf52d2a43c7374dcfb7f51d"
  },
  "apiStyle": "vertex-anthropic",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "claude-sonnet-5",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies VertexModelInput);
