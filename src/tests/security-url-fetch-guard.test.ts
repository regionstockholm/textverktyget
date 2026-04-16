import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  fetchPublicWebContent,
  isPrivateOrReservedIpAddress,
  UrlFetchGuardError,
} from "../utils/security/url-fetch-guard.js";

async function startServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start test server");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: http.Server): Promise<void> {
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

test("isPrivateOrReservedIpAddress identifies private and public IPs", () => {
  assert.equal(isPrivateOrReservedIpAddress("127.0.0.1"), true);
  assert.equal(isPrivateOrReservedIpAddress("10.0.0.5"), true);
  assert.equal(isPrivateOrReservedIpAddress("192.168.1.20"), true);
  assert.equal(isPrivateOrReservedIpAddress("8.8.8.8"), false);
  assert.equal(isPrivateOrReservedIpAddress("2001:4860:4860::8888"), false);
  assert.equal(isPrivateOrReservedIpAddress("::1"), true);
});

test("fetchPublicWebContent blocks localhost targets by default", async () => {
  await assert.rejects(
    () =>
      fetchPublicWebContent("http://localhost", {
        timeoutMs: 1000,
        maxRedirects: 2,
        maxResponseBytes: 1024,
        userAgent: "test-agent",
        allowPrivateNetwork: false,
      }),
    (error: unknown) =>
      error instanceof UrlFetchGuardError && error.code === "UNSAFE_HOST",
  );
});

test("fetchPublicWebContent rejects unsupported protocols", async () => {
  await assert.rejects(
    () =>
      fetchPublicWebContent("ftp://example.com/file.txt", {
        timeoutMs: 1000,
        maxRedirects: 2,
        maxResponseBytes: 1024,
        userAgent: "test-agent",
        allowPrivateNetwork: false,
      }),
    (error: unknown) =>
      error instanceof UrlFetchGuardError &&
      error.code === "UNSUPPORTED_PROTOCOL",
  );
});

test("fetchPublicWebContent enforces max response bytes", async () => {
  const { server, baseUrl } = await startServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("a".repeat(300));
  });

  try {
    await assert.rejects(
      () =>
        fetchPublicWebContent(baseUrl, {
          timeoutMs: 1000,
          maxRedirects: 2,
          maxResponseBytes: 128,
          userAgent: "test-agent",
          allowPrivateNetwork: true,
        }),
      (error: unknown) =>
        error instanceof UrlFetchGuardError && error.code === "CONTENT_TOO_LARGE",
    );
  } finally {
    await stopServer(server);
  }
});

test("fetchPublicWebContent enforces content-type allowlist", async () => {
  const { server, baseUrl } = await startServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.end("%PDF-1.5");
  });

  try {
    await assert.rejects(
      () =>
        fetchPublicWebContent(baseUrl, {
          timeoutMs: 1000,
          maxRedirects: 2,
          maxResponseBytes: 1024,
          userAgent: "test-agent",
          allowPrivateNetwork: true,
        }),
      (error: unknown) =>
        error instanceof UrlFetchGuardError &&
        error.code === "UNSUPPORTED_CONTENT_TYPE",
    );
  } finally {
    await stopServer(server);
  }
});

test("fetchPublicWebContent enforces redirect limits", async () => {
  const { server, baseUrl } = await startServer((req, res) => {
    if (req.url === "/redirect") {
      res.statusCode = 302;
      res.setHeader("Location", "/redirect");
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("ok");
  });

  try {
    await assert.rejects(
      () =>
        fetchPublicWebContent(`${baseUrl}/redirect`, {
          timeoutMs: 1000,
          maxRedirects: 1,
          maxResponseBytes: 1024,
          userAgent: "test-agent",
          allowPrivateNetwork: true,
        }),
      (error: unknown) =>
        error instanceof UrlFetchGuardError &&
        error.code === "TOO_MANY_REDIRECTS",
    );
  } finally {
    await stopServer(server);
  }
});

test("fetchPublicWebContent fetches allowed text payload", async () => {
  const { server, baseUrl } = await startServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("hello world");
  });

  try {
    const result = await fetchPublicWebContent(baseUrl, {
      timeoutMs: 1000,
      maxRedirects: 2,
      maxResponseBytes: 1024,
      userAgent: "test-agent",
      allowPrivateNetwork: true,
    });

    assert.equal(result.body, "hello world");
    assert.equal(result.contentType.includes("text/plain"), true);
  } finally {
    await stopServer(server);
  }
});
