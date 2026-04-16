import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { setupRoutes } from "../server/routes.js";

async function createServerWithRoutes(): Promise<{
  server: http.Server;
  baseUrl: string;
}> {
  const app = express();

  await setupRoutes(app);

  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("admin UI page loads", async () => {
  const { server, baseUrl } = await createServerWithRoutes();

  try {
    const response = await fetch(`${baseUrl}/admin-ui`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.ok(html.includes("Adminpanel"));
    assert.ok(html.includes("prompt-importantRules"));
    assert.ok(html.includes("prompt-senderIntent"));
    assert.ok(html.includes("runtime-settings-json"));
    assert.ok(html.includes("save-runtime-settings"));
    assert.ok(html.includes("save-runtime-settings-fields"));
    assert.ok(html.includes("runtime-provider-rpm-gemini"));
    assert.ok(html.includes("runtime-provider-rpm-openai"));
    assert.ok(html.includes("runtime-global-window-ms"));
    assert.ok(html.includes("runtime-global-max"));
    assert.ok(html.includes("runtime-api-window-ms"));
    assert.ok(html.includes("runtime-queue-concurrent"));
    assert.ok(html.includes("runtime-stage-analysis"));
    assert.ok(html.includes("runtime-upload-max-size-mb"));
    assert.ok(html.includes("runtime-upload-max-size-mb-selected"));
    assert.ok(html.includes("runtime-upload-max-size-mb-current"));
    assert.ok(html.includes("runtime-repair-min-subscore"));
    assert.ok(html.includes("runtime-repair-min-subscore-selected"));
    assert.ok(html.includes("runtime-repair-min-subscore-current"));
    assert.ok(html.includes("runtime-auto-enabled"));
    assert.ok(html.includes("runtime-auto-mode"));
    assert.ok(html.includes("runtime-auto-manual-profile"));
    assert.ok(html.includes("task-prompt-select"));
    assert.ok(html.includes("save-task-prompt"));
    assert.ok(html.includes("task-prompt-content"));
    assert.ok(html.includes("task-def-label"));
    assert.ok(html.includes("task-def-description"));
    assert.ok(html.includes("task-def-enabled"));
    assert.ok(html.includes("task-def-target-audience-enabled"));
    assert.ok(html.includes("task-def-rewrite-plan-enabled"));
    assert.ok(html.includes("task-def-create"));
    assert.ok(html.includes("task-def-delete"));
    assert.ok(html.includes("task-def-move-up"));
    assert.ok(html.includes("task-def-move-down"));
    assert.ok(html.includes("easy-read-task-enabled"));
    assert.ok(html.includes("easy-read-workflow-enabled"));
    assert.ok(html.includes("easy-read-workflow-use-rewrite-draft"));
    assert.ok(html.includes("save-easy-read-settings"));
    assert.ok(html.includes("easy-read-prompt-task"));
    assert.ok(html.includes("easy-read-prompt-importantRules"));
    assert.ok(html.includes("easy-read-prompt-role"));
    assert.ok(html.includes("easy-read-prompt-senderIntent"));
    assert.ok(html.includes("easy-read-prompt-rewritePlan"));
    assert.ok(html.includes("easy-read-prompt-qualityEvaluation"));
    assert.ok(html.includes("easy-read-prompt-wordListUsage"));
    assert.ok(html.includes("easy-read-prompt-rewriteFallback"));
    assert.ok(html.includes("data-easy-read-prompt-save=\"wordListUsage\""));
    assert.ok(html.includes("data-easy-read-prompt-save=\"rewriteFallback\""));
    assert.ok(html.includes("easy-read-prompt-targetAudience-fallback"));
    assert.ok(html.includes("easy-read-target-audience-select"));
    assert.ok(html.includes("easy-read-target-audience-prompt"));
    assert.ok(html.includes("save-easy-read-target-audience"));
    assert.ok(!html.includes("task-def-key"));
    assert.ok(!html.includes("task-def-output-mode"));
    assert.ok(!html.includes("task-def-bullet-count"));
    assert.ok(!html.includes("task-rewrite-plan-toggle"));
    assert.ok(!html.includes("task-def-update"));
    assert.ok(html.includes("data-view-target=\"prompts\""));
    assert.ok(html.includes("data-view=\"prompts\""));
    assert.ok(html.includes("data-view-target=\"easy-to-read\""));
    assert.ok(html.includes("data-view-target=\"target-audiences\""));
    assert.ok(html.includes("data-view-target=\"genai\""));
    assert.ok(html.includes("data-view-target=\"api-keys\""));
    assert.ok(html.includes("data-view-target=\"ordlista\""));
    assert.ok(html.includes("data-view-target=\"backup\""));
    assert.ok(html.includes("data-view=\"target-audiences\""));
    assert.ok(html.includes("data-view=\"easy-to-read\""));
    assert.ok(html.includes("data-view=\"genai\""));
    assert.ok(html.includes("data-view=\"api-keys\""));
    assert.ok(html.includes("data-view=\"ordlista\""));
    assert.ok(html.includes("data-view=\"backup\""));
    assert.ok(html.includes("admin-hint"));
    assert.ok(html.includes("AI-provider (global)"));
    assert.ok(html.includes("global-retry-current"));
    assert.ok(html.includes("global-retry-selected"));
    assert.ok(html.includes("global-quality-attempts"));
    assert.ok(html.includes("global-quality-attempts-current"));
    assert.ok(html.includes("global-quality-attempts-selected"));
    assert.ok(html.includes("global-repair-budget"));
    assert.ok(html.includes("global-repair-budget-current"));
    assert.ok(html.includes("global-repair-budget-selected"));
    assert.ok(html.includes("alla försök innan systemet ger upp"));
    assert.ok(html.includes("Gemini-model"));
    assert.ok(html.includes("gemini-temp-selected"));
    assert.ok(html.includes("gemini-temp-value"));
    assert.ok(html.includes("gemini-qe-temp"));
    assert.ok(html.includes("gemini-qe-temp-selected"));
    assert.ok(html.includes("gemini-qe-temp-value"));
    assert.ok(html.includes("Styr kreativitet"));
    assert.ok(html.includes("gemini-use-search"));
    assert.ok(html.includes("gemini-use-thinking"));
    assert.ok(html.includes("ersätter den tidigare nyckeln"));
    assert.ok(html.includes("ordlista-from"));
    assert.ok(html.includes("ordlista-to"));
    assert.ok(html.includes("ordlista-save"));
    assert.ok(html.includes("ordlista-clear"));
    assert.ok(html.includes("ordlista-list"));
    assert.ok(html.includes("backup-download"));
    assert.ok(html.includes("backup-upload"));
    assert.ok(html.includes("backup-import"));
    assert.ok(html.includes("/script/admin-ui.js"));
    assert.ok(html.includes("nonce=\""));
  } finally {
    await closeServer(server);
  }
});
