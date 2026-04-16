import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import apiRoutes from "../routes/api.js";
import { getPrismaClient } from "../config/database/prisma-client.js";

const prisma = getPrismaClient();
const hasDatabase = Boolean(process.env.DATABASE_URL);
const TEST_TASK_PREFIX = "test-public-task-";

async function createTestServer(): Promise<{
  server: http.Server;
  baseUrl: string;
}> {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRoutes);

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

async function cleanupTestTasks(): Promise<void> {
  await prisma.taskDefinition.deleteMany({
    where: { key: { startsWith: TEST_TASK_PREFIX } },
  });
}

test("GET /api/tasks returns enabled tasks sorted", { skip: !hasDatabase }, async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    t.skip("Database not reachable");
    return;
  }

  const { server, baseUrl } = await createTestServer();
  const taskA = `${TEST_TASK_PREFIX}${Date.now()}-a`;
  const taskB = `${TEST_TASK_PREFIX}${Date.now()}-b`;
  const taskC = `${TEST_TASK_PREFIX}${Date.now()}-c`;

  try {
    await prisma.taskDefinition.create({
      data: {
        key: taskA,
        label: "Public Task A",
        enabled: true,
        sortOrder: 20010,
        outputMode: "summary",
        rewritePlanEnabled: true,
      },
    });

    await prisma.taskDefinition.create({
      data: {
        key: taskB,
        label: "Public Task B",
        enabled: false,
        sortOrder: 20020,
        outputMode: "summary",
        rewritePlanEnabled: false,
      },
    });

    await prisma.taskDefinition.create({
      data: {
        key: taskC,
        label: "Public Task C",
        enabled: true,
        sortOrder: 20030,
        outputMode: "bullets",
        bulletCount: 4,
        rewritePlanEnabled: true,
      },
    });

    const response = await fetch(`${baseUrl}/api/tasks`);
    const payload = (await response.json()) as {
      success: boolean;
      data: Array<{
        key: string;
        label: string;
        sortOrder: number;
        promptName: string;
        settings: {
          outputMode: string;
          bulletCount: number | null;
        };
      }>;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);

    const keys = payload.data.map((task) => task.key);
    assert.equal(keys.includes(taskA), true);
    assert.equal(keys.includes(taskB), false);
    assert.equal(keys.includes(taskC), true);
    assert.ok(keys.indexOf(taskA) < keys.indexOf(taskC));

    const taskCResult = payload.data.find((task) => task.key === taskC);
    assert.equal(taskCResult?.promptName, `task:${taskC}`);
    assert.equal(taskCResult?.settings.outputMode, "bullets");
    assert.equal(taskCResult?.settings.bulletCount, 4);
  } finally {
    await closeServer(server);
    await cleanupTestTasks();
  }
});
