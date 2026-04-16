import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import apiRoutes from "../routes/api.js";

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

test("POST /api/summarize requires taskKey", async () => {
  const { server, baseUrl } = await createTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Detta ar en testtext som saknar taskKey.",
      }),
    });

    const payload = (await response.json()) as {
      success: boolean;
      error: string;
      details?: string;
    };

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error, "Invalid request");
    assert.equal(payload.details, "Vänligen välj en uppgift.");
  } finally {
    await closeServer(server);
  }
});
