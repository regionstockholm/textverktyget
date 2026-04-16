import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import apiRoutes from "../routes/api.js";
import { getPrismaClient } from "../config/database/prisma-client.js";

const prisma = getPrismaClient();
const hasDatabase = Boolean(process.env.DATABASE_URL);
const TEST_TASK_KEY = "test-task-missing-prompt";

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

test("POST /api/summarize fails hard when task prompt is missing", { skip: !hasDatabase }, async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    t.skip("Database not reachable");
    return;
  }

  const { server, baseUrl } = await createTestServer();

  try {
    await prisma.promptTemplate.deleteMany({
      where: { name: `task:${TEST_TASK_KEY}` },
    });
    await prisma.taskDefinition.deleteMany({
      where: { key: TEST_TASK_KEY },
    });

    await prisma.taskDefinition.create({
      data: {
        key: TEST_TASK_KEY,
        label: "Missing Prompt Task",
        enabled: true,
        sortOrder: 9990,
        outputMode: "rewrite",
        targetAudienceEnabled: true,
        rewritePlanEnabled: true,
      },
    });

    const response = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Detta ar en text for att testa felhantering nar task prompt saknas.",
        taskKey: TEST_TASK_KEY,
        checkboxContent: [],
      }),
    });

    const payload = (await response.json()) as {
      success: boolean;
      error: string;
      details?: string;
    };

    assert.equal(response.status, 500);
    assert.equal(payload.success, false);
    assert.equal(payload.error, "Task prompt missing");
  } finally {
    await closeServer(server);
    await prisma.promptTemplate.deleteMany({
      where: { name: `task:${TEST_TASK_KEY}` },
    });
    await prisma.taskDefinition.deleteMany({
      where: { key: TEST_TASK_KEY },
    });
  }
});
