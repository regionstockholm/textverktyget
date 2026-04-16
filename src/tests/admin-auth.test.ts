import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

const ADMIN_KEY = "admin-auth-test-key";
process.env.ADMIN_API_KEY = ADMIN_KEY;

const { adminAuthLimiter, requireAdminAuth } = await import(
  "../middleware/admin-auth.js"
);

async function createServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const app = express();
  app.set("trust proxy", 1);

  app.get("/admin/protected", adminAuthLimiter, requireAdminAuth, (_req, res) => {
    res.status(200).json({ success: true });
  });

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

async function request(
  baseUrl: string,
  authorizationHeader: string | null,
  ip: string,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    "X-Forwarded-For": ip,
  };
  if (authorizationHeader) {
    headers.Authorization = authorizationHeader;
  }

  const response = await fetch(`${baseUrl}/admin/protected`, { headers });
  const body = await response.json();
  return {
    status: response.status,
    body,
  };
}

test("requireAdminAuth accepts valid bearer token", async () => {
  const { server, baseUrl } = await createServer();

  try {
    const response = await request(
      baseUrl,
      `Bearer ${ADMIN_KEY}`,
      "203.0.113.10",
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
  } finally {
    await closeServer(server);
  }
});

test("requireAdminAuth rejects invalid bearer token", async () => {
  const { server, baseUrl } = await createServer();

  try {
    const response = await request(baseUrl, "Bearer wrong", "203.0.113.20");
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  } finally {
    await closeServer(server);
  }
});

test("adminAuthLimiter throttles repeated failed attempts", async () => {
  const { server, baseUrl } = await createServer();

  try {
    const ip = "203.0.113.30";
    let throttledResponse: { status: number; body: any } | null = null;

    for (let attempt = 1; attempt <= 25; attempt++) {
      const response = await request(baseUrl, "Bearer wrong", ip);

      if (attempt <= 20) {
        assert.equal(response.status, 401);
      }

      if (response.status === 429) {
        throttledResponse = response;
        break;
      }
    }

    assert.ok(throttledResponse, "Expected limiter to return HTTP 429");
    assert.equal(throttledResponse.status, 429);
    assert.equal(throttledResponse.body.success, false);
  } finally {
    await closeServer(server);
  }
});
