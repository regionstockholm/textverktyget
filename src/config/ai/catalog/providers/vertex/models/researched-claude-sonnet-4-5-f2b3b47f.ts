// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { VertexModelInput } from "../types.js";
export default defineModel({
  "provider": "vertex",
  "id": "claude-sonnet-4-5",
  "displayName": "claude-sonnet-4-5",
  "limits": {
    "contextWindow": 8192,
    "maxOutputTokens": 64000,
    "verification": "conservative"
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
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/claude/sonnet-4-5"
    ],
    "notes": "The source does not publish all token ceilings; explicit conservative application limits are used. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "aa002b1b1806e32bfe0bc46deda627cc7c3c73e5a693e07edcc8ff5bbd9221ce"
  },
  "apiStyle": "vertex-anthropic",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "conservative"
  },
  "apiModelId": "claude-sonnet-4-5",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies VertexModelInput);
