// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { AnthropicModelInput } from "../types.js";
export default defineModel({
  "provider": "anthropic",
  "id": "claude-sonnet-5",
  "displayName": "claude-sonnet-5",
  "limits": {
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "anthropic-adaptive",
    "enabledEffort": "medium",
    "canDisable": true
  },
  "temperature": "unsupported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://platform.claude.com/docs/en/models/sonnet-5/overview.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "68f590298ac0f5e6271fd2d9707084e4f9d2e7e22358d4bfa8f5279cbd690708"
  },
  "apiStyle": "chat",
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
} satisfies AnthropicModelInput);
