// Research snapshot; no runtime fetch. Edit a custom profile to override installation limits.
import { defineModel } from "../../../validation.js";
import type { AnthropicModelInput } from "../types.js";
export default defineModel({
  "provider": "anthropic",
  "id": "claude-fable-5-1",
  "displayName": "claude-fable-5-1",
  "limits": {
    "contextWindow": 1000000,
    "maxOutputTokens": 128000,
    "verification": "verified"
  },
  "reasoning": {
    "mode": "anthropic-adaptive",
    "enabledEffort": "medium",
    "canDisable": false
  },
  "temperature": "unsupported",
  "structuredOutput": "prompt",
  "status": "active",
  "metadata": {
    "reviewedAt": "2026-10-04",
    "revision": 1,
    "sources": [
      "https://platform.claude.com/docs/en/models/fable-5-1/overview.md"
    ],
    "notes": "Published context and output limits captured from the serving provider. Account access and live generation have not been tested.",
    "generatedBy": "catalog-maintenance",
    "sourceHash": "f32fbe39812dd73d0bfc8e58de18da67a59571ac5abb43a4c0bc645d9c8a8904"
  },
  "apiStyle": "chat",
  "readiness": {
    "adapter": "supported",
    "live": "untested",
    "specifications": "verified"
  },
  "apiModelId": "claude-fable-5-1",
  "aliases": [],
  "webSearch": false,
  "outputTokenParameter": "max_tokens",
  "deploymentRequired": false,
  "defaults": {
    "temperature": 0.7,
    "outputFraction": 0.95
  }
} satisfies AnthropicModelInput);
