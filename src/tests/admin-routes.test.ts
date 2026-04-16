import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import type { Prisma } from "@prisma/client";
import adminRoutes from "../routes/admin.js";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "test-admin-key";
const TEST_ACTOR = "test-admin";
const TEST_SECRET_NAME = "TEST_API_KEY";
const GLOBAL_KEY = "global";
const TARGET_AUDIENCE_NAME = "Patienter";
const TASK_PROMPT_PREFIX = "task:";
const TASK_PROMPT_NAME = "task:summary:shorten";
const ORDLISTA_FROM_ONE = "TestFrom";
const ORDLISTA_FROM_TWO = "TestFromTwo";
const BACKUP_TARGET_AUDIENCE = "BackupTest";
const BACKUP_TARGET_PROMPT = `targetAudience:${BACKUP_TARGET_AUDIENCE}`;
const BACKUP_ORDLISTA_FROM = "BackupFrom";
const BACKUP_CUSTOM_TASK_KEY = "backup:four-bullets";
const TEST_TASK_PREFIX = "test-task-";
const IMPORT_SYSTEM_PROMPT_COUNT = 7;
const IMPORT_TARGET_AUDIENCE_COUNT = 1;
const IMPORT_TASK_COUNT = 2;
const IMPORT_PROMPT_COUNT =
  IMPORT_SYSTEM_PROMPT_COUNT + IMPORT_TARGET_AUDIENCE_COUNT + IMPORT_TASK_COUNT;

const IMPORT_BACKUP_PAYLOAD = {
  schemaVersion: 3,
  app: "textverktyg",
  exportedAt: new Date().toISOString(),
  settings: {
    global: {
      provider: "openai",
      retryCount: 4,
    },
    providers: {
      gemini: {
        model: "models/gemini-1.5-pro",
        temperature: 0.2,
        maxOutputTokens: 65536,
        useWebSearch: true,
        useThinking: true,
      },
    },
    systemPrompts: [
      { name: "role", content: "BACKUP_ROLE" },
      { name: "importantRules", content: "BACKUP_IMPORTANT_RULES" },
      { name: "senderIntent", content: "BACKUP_SENDER_INTENT" },
      { name: "rewritePlan", content: "BACKUP_REWRITE_PLAN" },
      { name: "qualityEvaluation", content: "BACKUP_QUALITY_EVAL" },
      { name: "wordListUsage", content: "BACKUP_WORD_LIST_USAGE" },
      { name: "rewriteFallback", content: "BACKUP_REWRITE_FALLBACK" },
    ],
    targetAudiences: [
      {
        name: BACKUP_TARGET_AUDIENCE,
        content: "BACKUP_TARGET_CONTENT",
      },
    ],
    tasks: [
      {
        key: "summary:shorten",
        label: "Korta ned",
        description: "Kortare version",
        enabled: true,
        sortOrder: 10,
        settings: {
          outputMode: "summary",
          bulletCount: null,
          maxChars: null,
          targetAudienceEnabled: true,
          rewritePlanEnabled: true,
        },
        prompt: {
          content: "BACKUP_TASK_CONTENT",
        },
      },
      {
        key: BACKUP_CUSTOM_TASK_KEY,
        label: "Fyra punkter",
        description: "Sammanfatta i fyra punkter",
        enabled: true,
        sortOrder: 20,
        settings: {
          outputMode: "bullets",
          bulletCount: 4,
          maxChars: null,
          targetAudienceEnabled: false,
          rewritePlanEnabled: false,
        },
        prompt: {
          content: "BACKUP_CUSTOM_TASK_PROMPT",
        },
      },
    ],
    ordlista: [
      {
        fromWord: BACKUP_ORDLISTA_FROM,
        toWord: "BackupTo",
      },
    ],
  },
};

process.env.ADMIN_API_KEY = ADMIN_KEY;
process.env.CONFIG_MASTER_KEY =
  process.env.CONFIG_MASTER_KEY || "test-master-key";

const prisma = getPrismaClient();
const hasDatabase = Boolean(process.env.DATABASE_URL);

function getRewritePlanTasksForRestore(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

async function createTestServer(): Promise<{
  server: http.Server;
  baseUrl: string;
}> {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRoutes);

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

async function requestJson(
  baseUrl: string,
  path: string,
  options?: RequestInit,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

async function cleanupAuditLogs(): Promise<void> {
  await prisma.auditLog.deleteMany({
    where: { actor: TEST_ACTOR },
  });
}

async function cleanupPromptVersions(): Promise<void> {
  await prisma.promptTemplate.deleteMany({
    where: {
      name: "role",
      updatedBy: TEST_ACTOR,
    },
  });
}

async function cleanupTargetAudiencePrompts(): Promise<void> {
  await prisma.promptTemplate.deleteMany({
    where: {
      name: `targetAudience:${TARGET_AUDIENCE_NAME}`,
      updatedBy: TEST_ACTOR,
    },
  });
}

async function cleanupSecret(): Promise<void> {
  await prisma.secret.deleteMany({
    where: { name: TEST_SECRET_NAME },
  });
}

async function cleanupGlobalConfig(): Promise<void> {
  await prisma.globalConfig.deleteMany({
    where: { configKey: GLOBAL_KEY },
  });
}

async function cleanupOrdlista(): Promise<void> {
  await prisma.ordlistaEntry.deleteMany({
    where: { fromWord: { in: [ORDLISTA_FROM_ONE, ORDLISTA_FROM_TWO] } },
  });
}

async function cleanupTestTasks(): Promise<void> {
  await prisma.promptTemplate.deleteMany({
    where: {
      name: {
        startsWith: `${TASK_PROMPT_PREFIX}${TEST_TASK_PREFIX}`,
      },
    },
  });

  await prisma.taskDefinition.deleteMany({
    where: {
      key: {
        startsWith: TEST_TASK_PREFIX,
      },
    },
  });
}


test("admin routes", { skip: !hasDatabase }, async (t) => {
  if (!(await ensureDatabaseAvailable(t))) {
    return;
  }

  await t.test("rejects missing token", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const result = await requestJson(baseUrl, "/admin/config");
      assert.equal(result.status, 401);
      assert.equal(result.body.success, false);
    } finally {
      await closeServer(server);
    }
  });

  await t.test("rejects invalid token", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const result = await requestJson(baseUrl, "/admin/config", {
        headers: {
          Authorization: "Bearer invalid-key",
        },
      });
      assert.equal(result.status, 401);
      assert.equal(result.body.success, false);
    } finally {
      await closeServer(server);
    }
  });

  await t.test("returns config with valid token", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const result = await requestJson(baseUrl, "/admin/config", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.equal(typeof result.body.data.prompts.role, "string");
      assert.equal(typeof result.body.data.prompts.senderIntent, "string");
      assert.equal(typeof result.body.data.global.runtimeSettings, "object");
      assert.equal(typeof result.body.data.providers.gemini.model, "string");
    } finally {
      await closeServer(server);
    }
  });

  await t.test("returns runtime settings", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const result = await requestJson(baseUrl, "/admin/runtime-settings", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.equal(typeof result.body.data.runtimeSettings, "object");
    } finally {
      await closeServer(server);
    }
  });

  await t.test("returns summarize health snapshot", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const result = await requestJson(baseUrl, "/admin/ops/summarize-health", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.equal(typeof result.body.data.timestamp, "string");
      assert.equal(typeof result.body.data.features, "object");
      assert.equal(typeof result.body.data.activeProvider, "string");
      assert.equal(typeof result.body.data.summarizeQueue, "object");
      assert.equal(typeof result.body.data.stageConcurrency, "object");
      assert.equal(typeof result.body.data.autoProfile, "object");
      assert.equal(typeof result.body.data.runtimeSettings, "object");
    } finally {
      await closeServer(server);
    }
  });

  await t.test("exports backup payload", async () => {
    const { server, baseUrl } = await createTestServer();
    const orphanPromptName = `task:orphan-${Date.now()}`;

    await prisma.promptTemplate.create({
      data: {
        name: orphanPromptName,
        content: "ORPHAN_TASK_PROMPT",
        version: 1,
        isActive: true,
        updatedBy: TEST_ACTOR,
      },
    });

    try {
      const result = await requestJson(baseUrl, "/admin/backup", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.schemaVersion, 3);
      assert.equal(result.body.app, "textverktyg");
      assert.equal(typeof result.body.exportedAt, "string");
      assert.ok(Array.isArray(result.body.settings.systemPrompts));
      assert.ok(Array.isArray(result.body.settings.targetAudiences));
      assert.ok(Array.isArray(result.body.settings.tasks));
      assert.ok(Array.isArray(result.body.settings.ordlista));
      assert.equal(
        typeof result.body.settings.providers.gemini.model,
        "string",
      );
      assert.equal(
        typeof result.body.settings.providers.gemini.useWebSearch,
        "boolean",
      );
      assert.equal(
        typeof result.body.settings.providers.gemini.useThinking,
        "boolean",
      );
      assert.equal(typeof result.body.settings.global.provider, "string");
      assert.equal(typeof result.body.settings.global.retryCount, "number");
      assert.equal(typeof result.body.settings.global.runtimeSettings, "object");
      assert.ok(
        result.body.settings.tasks.every(
          (entry: { key: string }) =>
            entry.key !== orphanPromptName.replace(TASK_PROMPT_PREFIX, ""),
        ),
      );
    } finally {
      await prisma.promptTemplate.deleteMany({ where: { name: orphanPromptName } });
      await closeServer(server);
    }
  });

  await t.test("rejects invalid backup payload", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const invalidResult = await requestJson(baseUrl, "/admin/backup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schemaVersion: 2 }),
      });
      assert.equal(invalidResult.status, 400);
      assert.equal(invalidResult.body.success, false);
      assert.equal(invalidResult.body.error, "Validation Error");
    } finally {
      await closeServer(server);
    }
  });

  await t.test("imports backup payload", async () => {
    const systemPromptNames = [
      "role",
      "importantRules",
      "senderIntent",
      "rewritePlan",
      "qualityEvaluation",
      "wordListUsage",
      "rewriteFallback",
    ] as const;
    const existingSystemPrompts = await prisma.promptTemplate.findMany({
      where: {
        isActive: true,
        name: { in: [...systemPromptNames] },
      },
      select: {
        name: true,
        content: true,
      },
    });
    const systemPromptContentMap = new Map(
      existingSystemPrompts.map((entry) => [entry.name, entry.content]),
    );

    const importPayload = structuredClone(IMPORT_BACKUP_PAYLOAD);
    importPayload.settings.systemPrompts = systemPromptNames.map((name) => ({
      name,
      content: systemPromptContentMap.get(name) || `${name}-prompt`,
    }));

    const existingGlobal = await prisma.globalConfig.findUnique({
      where: { configKey: GLOBAL_KEY },
    });
    const existingProvider = await prisma.providerConfig.findUnique({
      where: { provider: "gemini" },
    });
    const existingTasks = await prisma.taskDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    await prisma.promptTemplate.deleteMany({
      where: {
        name: {
          in: [
            BACKUP_TARGET_PROMPT,
            TASK_PROMPT_NAME,
            `${TASK_PROMPT_PREFIX}${BACKUP_CUSTOM_TASK_KEY}`,
          ],
        },
      },
    });
    await prisma.ordlistaEntry.deleteMany({
      where: { fromWord: BACKUP_ORDLISTA_FROM },
    });

    const { server, baseUrl } = await createTestServer();

    try {
      const importResult = await requestJson(baseUrl, "/admin/backup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify(importPayload),
      });
      assert.equal(importResult.status, 200);
      assert.equal(importResult.body.success, true);
      assert.equal(importResult.body.data.imported.prompts, IMPORT_PROMPT_COUNT);
      assert.equal(importResult.body.data.imported.tasks, IMPORT_TASK_COUNT);
      assert.equal(importResult.body.data.imported.ordlista, 1);

      const configResult = await requestJson(baseUrl, "/admin/config", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(configResult.body.data.global.provider, "openai");
      assert.equal(configResult.body.data.global.retryCount, 4);
      assert.equal(
        configResult.body.data.global.rewritePlanTasks[BACKUP_CUSTOM_TASK_KEY],
        false,
      );
      assert.equal(
        configResult.body.data.providers.gemini.model,
        "models/gemini-1.5-pro",
      );
      assert.equal(configResult.body.data.providers.gemini.useWebSearch, true);
      assert.equal(configResult.body.data.providers.gemini.useThinking, true);

      const targetResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(BACKUP_TARGET_PROMPT)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(targetResult.body.data.content, "BACKUP_TARGET_CONTENT");

      const taskResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(TASK_PROMPT_NAME)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(taskResult.body.data.content, "BACKUP_TASK_CONTENT");

      const customTaskResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(`${TASK_PROMPT_PREFIX}${BACKUP_CUSTOM_TASK_KEY}`)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(customTaskResult.body.data.content, "BACKUP_CUSTOM_TASK_PROMPT");

      const tasksResult = await requestJson(baseUrl, "/admin/tasks", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(tasksResult.status, 200);
      assert.ok(
        tasksResult.body.data.some(
          (entry: { key: string }) => entry.key === BACKUP_CUSTOM_TASK_KEY,
        ),
      );

      const ordlistaResult = await requestJson(baseUrl, "/admin/ordlista", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.ok(
        ordlistaResult.body.data.some(
          (entry: { fromWord: string }) => entry.fromWord === BACKUP_ORDLISTA_FROM,
        ),
      );
    } finally {
      await closeServer(server);
      if (existingGlobal) {
        await prisma.globalConfig.update({
          where: { configKey: GLOBAL_KEY },
          data: {
            provider: existingGlobal.provider,
            retryCount: existingGlobal.retryCount,
            rewritePlanTasks: getRewritePlanTasksForRestore(
              (existingGlobal as { rewritePlanTasks?: unknown }).rewritePlanTasks,
            ),
            updatedBy: existingGlobal.updatedBy,
          },
        });
      } else {
        await cleanupGlobalConfig();
      }
      if (existingProvider) {
        const restoreProvider = {
          model: existingProvider.model,
          temperature: existingProvider.temperature,
          maxOutputTokens: existingProvider.maxOutputTokens,
          useWebSearch: (existingProvider as { useWebSearch?: boolean }).useWebSearch,
          useThinking: (existingProvider as { useThinking?: boolean }).useThinking,
        } as Record<string, unknown>;
        await prisma.providerConfig.update({
          where: { provider: "gemini" },
          data: restoreProvider,
        });
      } else {
        await prisma.providerConfig.deleteMany({ where: { provider: "gemini" } });
      }
      await prisma.promptTemplate.deleteMany({
        where: {
          name: {
            in: [
              BACKUP_TARGET_PROMPT,
              TASK_PROMPT_NAME,
              `${TASK_PROMPT_PREFIX}${BACKUP_CUSTOM_TASK_KEY}`,
            ],
          },
        },
      });
      await prisma.ordlistaEntry.deleteMany({
        where: { fromWord: BACKUP_ORDLISTA_FROM },
      });
      await prisma.taskDefinition.deleteMany();
      if (existingTasks.length > 0) {
        await prisma.taskDefinition.createMany({
          data: existingTasks.map((task) => ({
            key: task.key,
            label: task.label,
            description: task.description,
            enabled: task.enabled,
            sortOrder: task.sortOrder,
            outputMode: task.outputMode,
            bulletCount: task.bulletCount,
            maxChars: task.maxChars,
            targetAudienceEnabled: task.targetAudienceEnabled,
            rewritePlanEnabled: task.rewritePlanEnabled,
          })),
        });
      }
      await cleanupAuditLogs();
    }
  });

  await t.test("updates prompt content with versioning", async () => {
    const previousActive = await prisma.promptTemplate.findFirst({
      where: { name: "role", isActive: true },
    });

    const { server, baseUrl } = await createTestServer();

    try {
      const updateResult = await requestJson(baseUrl, "/admin/prompts/role", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({ content: "PROMPT_V1" }),
      });
      assert.equal(updateResult.status, 200);

      const versionOne = updateResult.body.data.version;

      const updateResultTwo = await requestJson(baseUrl, "/admin/prompts/role", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({ content: "PROMPT_V2" }),
      });
      assert.equal(updateResultTwo.status, 200);


      const versionsResult = await requestJson(
        baseUrl,
        "/admin/prompts/role/versions",
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(versionsResult.status, 200);
      assert.ok(versionsResult.body.data.length >= 2);

      const activateResult = await requestJson(
        baseUrl,
        `/admin/prompts/role/activate/${versionOne}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "X-Admin-Actor": TEST_ACTOR,
          },
        },
      );
      assert.equal(activateResult.status, 200);

      const configResult = await requestJson(baseUrl, "/admin/config", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(configResult.body.data.prompts.role, "PROMPT_V1");

      const auditEntry = await prisma.auditLog.findFirst({
        where: { actor: TEST_ACTOR, action: "prompt.update" },
      });
      assert.ok(auditEntry);
    } finally {
      await closeServer(server);
      if (previousActive) {
        await prisma.promptTemplate.updateMany({
          where: { name: "role" },
          data: { isActive: false },
        });
        await prisma.promptTemplate.update({
          where: { id: previousActive.id },
          data: { isActive: true },
        });
      }
      await cleanupPromptVersions();
      await cleanupAuditLogs();
    }
  });

  await t.test("updates task prompt overrides", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const updateResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(TASK_PROMPT_NAME)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
            "X-Admin-Actor": TEST_ACTOR,
          },
          body: JSON.stringify({ content: "TASK_PROMPT_V1" }),
        },
      );
      assert.equal(updateResult.status, 200);

      const fetchResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(TASK_PROMPT_NAME)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(fetchResult.status, 200);
      assert.equal(fetchResult.body.data.content, "TASK_PROMPT_V1");
    } finally {
      await closeServer(server);
      await prisma.promptTemplate.deleteMany({ where: { name: TASK_PROMPT_NAME } });
    }
  });

  await t.test("updates dynamic task prompt overrides", async () => {
    const { server, baseUrl } = await createTestServer();
    const taskKey = `${TEST_TASK_PREFIX}${Date.now()}-prompt`;
    const promptName = `task:${taskKey}`;

    await prisma.taskDefinition.create({
      data: {
        key: taskKey,
        label: "Dynamic Prompt Task",
        sortOrder: 9990,
        outputMode: "rewrite",
        rewritePlanEnabled: true,
      },
    });

    try {
      const emptyFetchResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(promptName)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(emptyFetchResult.status, 200);
      assert.equal(emptyFetchResult.body.data.content, "");

      const updateResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(promptName)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
            "X-Admin-Actor": TEST_ACTOR,
          },
          body: JSON.stringify({ content: "DYNAMIC_TASK_PROMPT_V1" }),
        },
      );
      assert.equal(updateResult.status, 200);

      const fetchResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(promptName)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(fetchResult.status, 200);
      assert.equal(fetchResult.body.data.content, "DYNAMIC_TASK_PROMPT_V1");

      const missingPromptResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent("task:missing-dynamic-task")}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(missingPromptResult.status, 404);
    } finally {
      await closeServer(server);
      await prisma.promptTemplate.deleteMany({ where: { name: promptName } });
      await prisma.taskDefinition.deleteMany({ where: { key: taskKey } });
      await cleanupAuditLogs();
    }
  });

  await t.test("updates target audience prompt", async () => {
    const { server, baseUrl } = await createTestServer();
    const promptName = `targetAudience:${TARGET_AUDIENCE_NAME}`;
    const encodedName = encodeURIComponent(promptName);

    try {
      const updateResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodedName}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
            "X-Admin-Actor": TEST_ACTOR,
          },
          body: JSON.stringify({ content: "TARGET_OVERRIDE" }),
        },
      );
      assert.equal(updateResult.status, 200);

      const fetchResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodedName}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(fetchResult.status, 200);
      assert.equal(fetchResult.body.data.content, "TARGET_OVERRIDE");
    } finally {
      await closeServer(server);
      await cleanupTargetAudiencePrompts();
      await cleanupAuditLogs();
    }
  });

  await t.test("validates gemini model updates", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const invalidResult = await requestJson(
        baseUrl,
        "/admin/providers/gemini",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "invalid-model",
            temperature: 0.7,
            maxOutputTokens: 65536,
          }),
        },
      );
      assert.equal(invalidResult.status, 400);
    } finally {
      await closeServer(server);
    }
  });

  await t.test("updates gemini provider config", async () => {
    const existing = await prisma.providerConfig.findUnique({
      where: { provider: "gemini" },
    });

    const { server, baseUrl } = await createTestServer();

    try {
      const updatedProvider = {
        model: "gemini-1.5-pro",
        temperature: 0.2,
        maxOutputTokens: 1234,
        useWebSearch: false,
        useThinking: true,
      };

      const updateResult = await requestJson(baseUrl, "/admin/providers/gemini", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify(updatedProvider),
      });
      assert.equal(updateResult.status, 200);
      assert.ok(updateResult.body.data.model.includes("gemini-1.5-pro"));
      assert.equal(updateResult.body.data.temperature, updatedProvider.temperature);
      assert.equal(
        updateResult.body.data.maxOutputTokens,
        updatedProvider.maxOutputTokens,
      );
      assert.equal(updateResult.body.data.useWebSearch, false);
      assert.equal(updateResult.body.data.useThinking, true);
    } finally {
      await closeServer(server);
      if (existing) {
        const restoreProvider = {
          model: existing.model,
          temperature: existing.temperature,
          maxOutputTokens: existing.maxOutputTokens,
          useWebSearch: (existing as { useWebSearch?: boolean }).useWebSearch,
          useThinking: (existing as { useThinking?: boolean }).useThinking,
        } as Record<string, unknown>;
        await prisma.providerConfig.update({
          where: { provider: "gemini" },
          data: restoreProvider,
        });
      } else {
        await prisma.providerConfig.deleteMany({
          where: { provider: "gemini" },
        });
      }
      await cleanupAuditLogs();
    }
  });

  await t.test("stores and masks secrets", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const secretValue = "secret-value-1234";
      const updateResult = await requestJson(
        baseUrl,
        `/admin/secrets/${TEST_SECRET_NAME}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
            "X-Admin-Actor": TEST_ACTOR,
          },
          body: JSON.stringify({ value: secretValue }),
        },
      );
      assert.equal(updateResult.status, 200);
      assert.ok(updateResult.body.data.masked.endsWith("1234"));

      const listResult = await requestJson(baseUrl, "/admin/secrets", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(listResult.status, 200);
      const secretEntry = listResult.body.data.find(
        (entry: { name: string }) => entry.name === TEST_SECRET_NAME,
      );
      assert.ok(secretEntry);

      const stored = await prisma.secret.findUnique({
        where: { name: TEST_SECRET_NAME },
      });
      assert.ok(stored);
      assert.notEqual(stored?.cipherText, secretValue);
    } finally {
      await closeServer(server);
      await cleanupSecret();
      await cleanupAuditLogs();
    }
  });

  await t.test("updates global config", async () => {
    const existing = await prisma.globalConfig.findUnique({
      where: { configKey: GLOBAL_KEY },
    });

    const { server, baseUrl } = await createTestServer();

    try {
      const updateResult = await requestJson(baseUrl, "/admin/config/global", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({ provider: "openai", retryCount: 4 }),
      });
      assert.equal(updateResult.status, 200);
      assert.equal(updateResult.body.data.provider, "openai");
      assert.equal(updateResult.body.data.retryCount, 4);

      const configResult = await requestJson(baseUrl, "/admin/config", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(configResult.body.data.global.provider, "openai");
      assert.equal(configResult.body.data.global.retryCount, 4);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { actor: TEST_ACTOR, action: "global.update" },
      });
      assert.ok(auditEntry);
    } finally {
      await closeServer(server);
      if (existing) {
        await prisma.globalConfig.update({
          where: { configKey: GLOBAL_KEY },
          data: {
            provider: existing.provider,
            retryCount: existing.retryCount,
            rewritePlanTasks: getRewritePlanTasksForRestore(
              (existing as { rewritePlanTasks?: unknown }).rewritePlanTasks,
            ),
            updatedBy: existing.updatedBy,
          },
        });
      } else {
        await cleanupGlobalConfig();
      }
      await cleanupAuditLogs();
    }
  });

  await t.test("validates atomic task prompt save payload", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const invalidTaskKeyResult = await requestJson(
        baseUrl,
        "/admin/task-prompts/unknown-task",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "TASK_PROMPT_V1",
            rewritePlanEnabled: true,
          }),
        },
      );
      assert.equal(invalidTaskKeyResult.status, 400);
      assert.equal(invalidTaskKeyResult.body.error, "Invalid taskKey");

      const invalidContentResult = await requestJson(
        baseUrl,
        "/admin/task-prompts/summary:shorten",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "   ",
            rewritePlanEnabled: true,
          }),
        },
      );
      assert.equal(invalidContentResult.status, 400);
      assert.equal(invalidContentResult.body.error, "Invalid prompt content");

      const invalidRewritePlanEnabledResult = await requestJson(
        baseUrl,
        "/admin/task-prompts/summary:shorten",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "TASK_PROMPT_V1",
            rewritePlanEnabled: "true",
          }),
        },
      );
      assert.equal(invalidRewritePlanEnabledResult.status, 400);
      assert.equal(
        invalidRewritePlanEnabledResult.body.error,
        "Invalid rewritePlanEnabled flag",
      );
    } finally {
      await closeServer(server);
    }
  });

  await t.test("manages task definitions", async () => {
    const { server, baseUrl } = await createTestServer();
    const now = Date.now();
    const taskLabelOne = `${TEST_TASK_PREFIX}${now}-one`;
    const taskLabelTwo = `${TEST_TASK_PREFIX}${now}-two`;
    let taskKeyOne = "";
    let taskKeyTwo = "";
    let taskKeyThree = "";

    try {
      const invalidCreate = await requestJson(baseUrl, "/admin/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          label: "   ",
        }),
      });
      assert.equal(invalidCreate.status, 400);

      const createOne = await requestJson(baseUrl, "/admin/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          label: taskLabelOne,
          description: "Task one description",
          targetAudienceEnabled: false,
          rewritePlanEnabled: true,
        }),
      });
      assert.equal(createOne.status, 201);
      taskKeyOne = createOne.body.data.key;
      assert.ok(taskKeyOne.startsWith(`${TEST_TASK_PREFIX}${now}-one`));
      assert.equal(createOne.body.data.targetAudienceEnabled, false);

      const defaultPrompt = await prisma.promptTemplate.findFirst({
        where: { name: `${TASK_PROMPT_PREFIX}${taskKeyOne}`, isActive: true },
        orderBy: { version: "desc" },
      });
      assert.ok(defaultPrompt);
      assert.ok((defaultPrompt?.content || "").trim().length > 0);

      const createTwo = await requestJson(baseUrl, "/admin/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          label: taskLabelTwo,
          rewritePlanEnabled: false,
          promptContent: "CUSTOM_TASK_PROMPT_TWO",
        }),
      });
      assert.equal(createTwo.status, 201);
      taskKeyTwo = createTwo.body.data.key;
      assert.ok(taskKeyTwo.startsWith(`${TEST_TASK_PREFIX}${now}-two`));

      const customPromptResult = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(`${TASK_PROMPT_PREFIX}${taskKeyTwo}`)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(customPromptResult.status, 200);
      assert.equal(customPromptResult.body.data.content, "CUSTOM_TASK_PROMPT_TWO");

      const createThree = await requestJson(baseUrl, "/admin/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          label: taskLabelOne,
          promptContent: "",
        }),
      });
      assert.equal(createThree.status, 201);
      taskKeyThree = createThree.body.data.key;
      assert.notEqual(taskKeyThree, taskKeyOne);

      const emptyPromptFetch = await requestJson(
        baseUrl,
        `/admin/prompts/${encodeURIComponent(`${TASK_PROMPT_PREFIX}${taskKeyThree}`)}`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
          },
        },
      );
      assert.equal(emptyPromptFetch.status, 200);
      assert.equal(emptyPromptFetch.body.data.content, "");

      const listTasks = await requestJson(baseUrl, "/admin/tasks", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(listTasks.status, 200);
      assert.ok(
        listTasks.body.data.some(
          (task: { key: string }) => task.key === taskKeyOne,
        ),
      );

      const updateTask = await requestJson(baseUrl, `/admin/tasks/${taskKeyOne}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          key: "should-not-change",
          label: "Test Task One Updated",
          rewritePlanEnabled: false,
        }),
      });
      assert.equal(updateTask.status, 200);
      assert.equal(updateTask.body.data.key, taskKeyOne);
      assert.equal(updateTask.body.data.label, "Test Task One Updated");
      assert.equal(updateTask.body.data.rewritePlanEnabled, false);

      const reorderTasks = await requestJson(baseUrl, "/admin/tasks/reorder", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          taskKeys: [taskKeyTwo, taskKeyOne],
        }),
      });
      assert.equal(reorderTasks.status, 200);
      const orderedKeys = reorderTasks.body.data.map(
        (task: { key: string }) => task.key,
      );
      assert.ok(orderedKeys.indexOf(taskKeyTwo) < orderedKeys.indexOf(taskKeyOne));

      const deleteOne = await requestJson(baseUrl, `/admin/tasks/${taskKeyOne}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "X-Admin-Actor": TEST_ACTOR,
        },
      });
      assert.equal(deleteOne.status, 200);
      assert.equal(deleteOne.body.data.deleted, true);

      const deleteTwo = await requestJson(baseUrl, `/admin/tasks/${taskKeyTwo}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "X-Admin-Actor": TEST_ACTOR,
        },
      });
      assert.equal(deleteTwo.status, 200);
      assert.equal(deleteTwo.body.data.deleted, true);

      const deletedPrompt = await prisma.promptTemplate.findFirst({
        where: {
          name: `${TASK_PROMPT_PREFIX}${taskKeyTwo}`,
          isActive: true,
        },
      });
      assert.equal(deletedPrompt, null);

      const deleteThree = await requestJson(baseUrl, `/admin/tasks/${taskKeyThree}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "X-Admin-Actor": TEST_ACTOR,
        },
      });
      assert.equal(deleteThree.status, 200);
      assert.equal(deleteThree.body.data.deleted, true);

      const auditCreate = await prisma.auditLog.findFirst({
        where: { actor: TEST_ACTOR, action: "task.create" },
      });
      const auditUpdate = await prisma.auditLog.findFirst({
        where: { actor: TEST_ACTOR, action: "task.update" },
      });
      const auditDelete = await prisma.auditLog.findFirst({
        where: { actor: TEST_ACTOR, action: "task.delete" },
      });
      const auditReorder = await prisma.auditLog.findFirst({
        where: { actor: TEST_ACTOR, action: "task.reorder" },
      });

      assert.ok(auditCreate);
      assert.ok(auditUpdate);
      assert.ok(auditDelete);
      assert.ok(auditReorder);
    } finally {
      await closeServer(server);
      await cleanupTestTasks();
      await cleanupAuditLogs();
    }
  });

  await t.test("manages ordlista entries", async () => {
    const { server, baseUrl } = await createTestServer();

    try {
      const createResult = await requestJson(baseUrl, "/admin/ordlista", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          fromWord: ORDLISTA_FROM_ONE,
          toWord: "TestTo",
        }),
      });
      assert.equal(createResult.status, 200);
      const createdId = createResult.body.data.id;

      const listResult = await requestJson(baseUrl, "/admin/ordlista", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(listResult.status, 200);
      assert.ok(
        listResult.body.data.some(
          (entry: { id: number }) => entry.id === createdId,
        ),
      );

      const deleteResult = await requestJson(
        baseUrl,
        `/admin/ordlista/${createdId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${ADMIN_KEY}`,
            "X-Admin-Actor": TEST_ACTOR,
          },
        },
      );
      assert.equal(deleteResult.status, 200);
      assert.equal(deleteResult.body.data.deleted, true);

      await requestJson(baseUrl, "/admin/ordlista", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          fromWord: ORDLISTA_FROM_TWO,
          toWord: "TestTo",
        }),
      });

      const clearResult = await requestJson(baseUrl, "/admin/ordlista", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "X-Admin-Actor": TEST_ACTOR,
        },
      });
      assert.equal(clearResult.status, 200);
      assert.ok(clearResult.body.data.deletedCount >= 1);

      const listAfterClear = await requestJson(baseUrl, "/admin/ordlista", {
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
        },
      });
      assert.equal(listAfterClear.status, 200);
      assert.equal(listAfterClear.body.data.length, 0);
    } finally {
      await closeServer(server);
      await cleanupOrdlista();
      await cleanupAuditLogs();
    }
  });

});
