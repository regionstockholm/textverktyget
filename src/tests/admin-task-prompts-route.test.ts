import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import adminRoutes from "../routes/admin.js";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../config/database/prisma-client.js";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "test-admin-key";
const TEST_ACTOR = "test-admin";
const GLOBAL_KEY = "global";
const TASK_PROMPT_NAME = "task:summary:shorten";

process.env.ADMIN_API_KEY = ADMIN_KEY;

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
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, body };
}

async function cleanupAuditLogs(): Promise<void> {
  await prisma.auditLog.deleteMany({
    where: { actor: TEST_ACTOR },
  });
}

test("validates atomic task prompt save endpoint", async () => {
  const { server, baseUrl } = await createTestServer();

  try {
    const invalidTaskKeyResult = await requestJson(
      baseUrl,
      "/admin/task-prompts/invalid_",
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
    assert.equal(
      (invalidTaskKeyResult.body as { error?: string } | null)?.error,
      "Invalid taskKey",
    );

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
    assert.equal(
      (invalidContentResult.body as { error?: string } | null)?.error,
      "Invalid prompt content",
    );

    const invalidToggleResult = await requestJson(
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
    assert.equal(invalidToggleResult.status, 400);
    assert.equal(
      (invalidToggleResult.body as { error?: string } | null)?.error,
      "Invalid rewritePlanEnabled flag",
    );
  } finally {
    await closeServer(server);
  }
});

test(
  "saves prompt and rewrite toggle atomically",
  { skip: !hasDatabase },
  async (t) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      t.skip("Database not reachable");
      return;
    }

    const existingGlobal = await prisma.globalConfig.findUnique({
      where: { configKey: GLOBAL_KEY },
    });
    const previousActivePrompt = await prisma.promptTemplate.findFirst({
      where: { name: TASK_PROMPT_NAME, isActive: true },
    });
    const { server, baseUrl } = await createTestServer();

    try {
      const content = `ATOMIC_TASK_PROMPT_${Date.now()}`;
      const result = await requestJson(baseUrl, "/admin/task-prompts/summary:shorten", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
          "X-Admin-Actor": TEST_ACTOR,
        },
        body: JSON.stringify({
          content,
          rewritePlanEnabled: false,
        }),
      });

      assert.equal(result.status, 200);
      const responseData = (result.body as {
        data?: {
          taskKey?: string;
          prompt?: { content?: string };
          rewritePlanTasks?: Record<string, boolean>;
        };
      } | null)?.data;
      assert.equal(responseData?.taskKey, "summary:shorten");
      assert.equal(responseData?.prompt?.content, content);
      assert.equal(responseData?.rewritePlanTasks?.["summary:shorten"], false);

      const savedPrompt = await prisma.promptTemplate.findFirst({
        where: { name: TASK_PROMPT_NAME, isActive: true },
        orderBy: { version: "desc" },
      });
      assert.ok(savedPrompt);
      assert.equal(savedPrompt?.content, content);

      const savedGlobal = await prisma.globalConfig.findUnique({
        where: { configKey: GLOBAL_KEY },
      });
      assert.ok(savedGlobal);
      const rewritePlanTasks =
        savedGlobal?.rewritePlanTasks as Record<string, boolean> | null | undefined;
      assert.equal(rewritePlanTasks?.["summary:shorten"], false);

      const promptAuditEntry = await prisma.auditLog.findFirst({
        where: {
          actor: TEST_ACTOR,
          action: "prompt.update",
          entity: "prompt_template",
        },
        orderBy: { id: "desc" },
      });
      assert.ok(promptAuditEntry);
      assert.equal(promptAuditEntry?.entityId, `${TASK_PROMPT_NAME}:${savedPrompt?.version}`);

      const rewriteAuditEntry = await prisma.auditLog.findFirst({
        where: {
          actor: TEST_ACTOR,
          action: "rewrite_plan_task.update",
          entity: "global_config",
          entityId: GLOBAL_KEY,
        },
        orderBy: { id: "desc" },
      });
      assert.ok(rewriteAuditEntry);
    } finally {
      await closeServer(server);
      if (existingGlobal) {
        await prisma.globalConfig.update({
          where: { configKey: GLOBAL_KEY },
          data: {
            provider: existingGlobal.provider,
            retryCount: existingGlobal.retryCount,
            rewritePlanTasks: getRewritePlanTasksForRestore(existingGlobal.rewritePlanTasks),
            updatedBy: existingGlobal.updatedBy,
          },
        });
      } else {
        await prisma.globalConfig.deleteMany({
          where: { configKey: GLOBAL_KEY },
        });
      }

      await prisma.promptTemplate.deleteMany({
        where: {
          name: TASK_PROMPT_NAME,
          updatedBy: TEST_ACTOR,
        },
      });

      if (previousActivePrompt) {
        await prisma.promptTemplate.updateMany({
          where: { name: TASK_PROMPT_NAME },
          data: { isActive: false },
        });
        await prisma.promptTemplate.update({
          where: { id: previousActivePrompt.id },
          data: { isActive: true },
        });
      }
      await cleanupAuditLogs();
    }
  },
);
