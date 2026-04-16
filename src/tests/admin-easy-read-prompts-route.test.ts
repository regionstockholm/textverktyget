import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import adminRoutes from "../routes/admin.js";
import { getPrismaClient } from "../config/database/prisma-client.js";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "test-admin-key";
const TEST_ACTOR = "test-admin";
const hasDatabase = Boolean(process.env.DATABASE_URL);

process.env.ADMIN_API_KEY = ADMIN_KEY;

const prisma = getPrismaClient();

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

async function restorePrompt(name: string, previousActiveId: number | null) {
  await prisma.promptTemplate.deleteMany({
    where: { name, updatedBy: TEST_ACTOR },
  });

  if (previousActiveId) {
    await prisma.promptTemplate.updateMany({
      where: { name },
      data: { isActive: false },
    });
    await prisma.promptTemplate.update({
      where: { id: previousActiveId },
      data: { isActive: true },
    });
  }
}

test(
  "supports easyToRead-related base prompt names",
  { skip: !hasDatabase },
  async (t) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      t.skip("Database not reachable");
      return;
    }

    const promptNames = ["wordListUsage", "rewriteFallback"] as const;
    const previousActiveIds = new Map<string, number | null>();

    for (const name of promptNames) {
      const previousActive = await prisma.promptTemplate.findFirst({
        where: { name, isActive: true },
        select: { id: true },
      });
      previousActiveIds.set(name, previousActive?.id ?? null);
    }

    const { server, baseUrl } = await createTestServer();

    try {
      for (const name of promptNames) {
        const content = `${name.toUpperCase()}_${Date.now()}`;
        const updateResult = await requestJson(
          baseUrl,
          `/admin/prompts/${encodeURIComponent(name)}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${ADMIN_KEY}`,
              "Content-Type": "application/json",
              "X-Admin-Actor": TEST_ACTOR,
            },
            body: JSON.stringify({ content }),
          },
        );

        assert.equal(updateResult.status, 200);

        const getResult = await requestJson(
          baseUrl,
          `/admin/prompts/${encodeURIComponent(name)}`,
          {
            headers: {
              Authorization: `Bearer ${ADMIN_KEY}`,
            },
          },
        );

        assert.equal(getResult.status, 200);
        assert.equal(
          (getResult.body as { data?: { content?: string } } | null)?.data?.content,
          content,
        );
      }
    } finally {
      await closeServer(server);
      for (const name of promptNames) {
        await restorePrompt(name, previousActiveIds.get(name) ?? null);
      }
    }
  },
);
