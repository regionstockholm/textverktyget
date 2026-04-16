import test from "node:test";
import assert from "node:assert/strict";
import { validateBackupPayload } from "../services/config/backup-schema.js";

function createBaseSettings() {
  return {
    global: {
      provider: "openai",
      retryCount: 4,
      runtimeSettings: {
        summarizeQueue: {
          maxConcurrentJobs: 8,
        },
      },
    },
    providers: {
      gemini: {
        model: "models/gemini-1.5-pro",
        temperature: 0.2,
        maxOutputTokens: 4096,
        useWebSearch: true,
        useThinking: true,
      },
    },
    systemPrompts: [
      { name: "role", content: "ROLE_PROMPT" },
      { name: "importantRules", content: "RULES_PROMPT" },
      { name: "senderIntent", content: "SENDER_PROMPT" },
      { name: "rewritePlan", content: "REWRITE_PLAN_PROMPT" },
      { name: "qualityEvaluation", content: "QUALITY_EVAL_PROMPT" },
      { name: "wordListUsage", content: "WORD_LIST_PROMPT" },
      { name: "rewriteFallback", content: "REWRITE_FALLBACK_PROMPT" },
    ],
    targetAudienceCategories: [
      {
        name: "Standard",
        sortOrder: 10,
      },
    ],
    targetAudiences: [
      {
        label: "Patienter",
        category: "Standard",
        sortOrder: 10,
        prompt: {
          content: "TARGET_AUDIENCE_PROMPT",
        },
      },
    ],
    tasks: [
      {
        label: "Fyra punkter",
        description: "Sammanfatta i fyra punkter",
        enabled: true,
        sortOrder: 10,
        targetAudienceEnabled: true,
        rewritePlanEnabled: false,
        prompt: {
          content: "TASK_PROMPT",
        },
      },
    ],
    ordlista: [
      {
        fromWord: "Hej",
        toWord: "Halloj",
      },
    ],
  };
}

test("validateBackupPayload accepts schema v4", () => {
  const payload = {
    schemaVersion: 4,
    app: "textverktyg",
    exportedAt: new Date().toISOString(),
    settings: createBaseSettings(),
  };

  const result = validateBackupPayload(payload);
  assert.equal(result.ok, true);
});

test("validateBackupPayload rejects schema v2 payload", () => {
  const payload = {
    schemaVersion: 2,
    app: "textverktyg",
    exportedAt: new Date().toISOString(),
    settings: createBaseSettings(),
  };

  const result = validateBackupPayload(payload);
  assert.equal(result.ok, false);
});

test("validateBackupPayload rejects missing required system prompts", () => {
  const payload = {
    schemaVersion: 4,
    app: "textverktyg",
    exportedAt: new Date().toISOString(),
    settings: {
      ...createBaseSettings(),
      systemPrompts: [{ name: "role", content: "ROLE_PROMPT" }],
    },
  };

  const result = validateBackupPayload(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.errors.some((error) =>
        error.includes("settings.systemPrompts must include"),
      ),
    );
  }
});

test("validateBackupPayload rejects invalid task settings", () => {
  const payload = {
    schemaVersion: 4,
    app: "textverktyg",
    exportedAt: new Date().toISOString(),
    settings: {
      ...createBaseSettings(),
      tasks: [
        {
          label: "Invalid Task",
          description: null,
          enabled: true,
          sortOrder: 10,
          targetAudienceEnabled: true,
          rewritePlanEnabled: "yes",
          prompt: {
            content: "TASK_PROMPT",
          },
        },
      ],
    },
  };

  const result = validateBackupPayload(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.errors.some((error) =>
        error.includes("settings.tasks[0].rewritePlanEnabled"),
      ),
    );
  }
});
