import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { setupRoutes } from "../server/routes.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "test-admin-key";
process.env.ADMIN_API_KEY = ADMIN_KEY;
process.env.CONFIG_MASTER_KEY =
  process.env.CONFIG_MASTER_KEY || "test-master-key";
const hasDatabase = Boolean(process.env.DATABASE_URL);

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

async function requestJson(
  baseUrl: string,
  path: string,
  options?: RequestInit,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

test("setupRoutes mounts admin endpoints", { skip: !hasDatabase }, async (t) => {
  if (!(await ensureDatabaseAvailable(t))) {
    return;
  }

  const { server, baseUrl } = await createServerWithRoutes();

  try {
    const result = await requestJson(baseUrl, "/admin/config", {
      headers: {
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
  } finally {
    await closeServer(server);
  }
});
