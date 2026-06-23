import http from "http";
import type { Application } from "express";
import { createApp } from "./app.js";
import { setupRoutes } from "./routes.js";
import { testConnection } from "../config/database/db-connection.js";
import { applyDefaultConfigIfDatabaseEmpty } from "../services/config/default-config-bootstrap-service.js";
import { ensureTaskPromptDefaults } from "../services/tasks/task-prompt-bootstrap-service.js";
import { assertSafeAdminCredentialsForStartup } from "../config/security/admin-credential-policy.js";

const DEFAULT_PORT = 3000;
const MIN_PORT = 1024;
const MAX_PORT = 65535;
const DEFAULT_HOST = "0.0.0.0";
const DB_CONNECT_TIMEOUT_MS = 10000;
const DB_CONNECT_RETRY_DELAY_MS = 2000;
const MAX_DB_CONNECT_ATTEMPTS = 3;

function resolvePort(port: unknown): number {
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort)) {
    return DEFAULT_PORT;
  }

  if (parsedPort < MIN_PORT || parsedPort > MAX_PORT) {
    throw new Error(`Port must be between ${MIN_PORT} and ${MAX_PORT}`);
  }

  return parsedPort;
}

function resolveHost(host: unknown): string {
  return typeof host === "string" && host.trim().length > 0
    ? host.trim()
    : DEFAULT_HOST;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createConnectionTimeout(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("Database connection test timeout"));
    }, DB_CONNECT_TIMEOUT_MS);
  });
}

async function testDatabaseConnection(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_DB_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      const isConnected = await Promise.race([
        testConnection(),
        createConnectionTimeout(),
      ]);

      if (isConnected) {
        return true;
      }
    } catch (error) {
      console.error(`Database connection test failed (attempt ${attempt}):`, error);
    }

    if (attempt < MAX_DB_CONNECT_ATTEMPTS) {
      await wait(DB_CONNECT_RETRY_DELAY_MS);
    }
  }

  return false;
}

async function bootstrapDatabaseDefaults(): Promise<void> {
  try {
    const bootstrapResult = await applyDefaultConfigIfDatabaseEmpty("startup");
    if (bootstrapResult.applied) {
      console.log(
        `[Startup] Applied default config (${bootstrapResult.tasksCreated} tasks, ${bootstrapResult.promptsCreated} prompts, ${bootstrapResult.ordlistaCreated} ordlista entries)`,
      );
    }

    const promptResult = await ensureTaskPromptDefaults("startup");
    if (promptResult.created > 0) {
      console.log(
        `[Startup] Ensured task prompts for ${promptResult.checked} tasks (${promptResult.created} created)`,
      );
    }
  } catch (error) {
    console.error("[Startup] Failed to ensure task prompt defaults:", error);
  }
}

async function initializeBackgroundServices(): Promise<void> {
  const { initializeTextQualityControl } = await import(
    "../services/quality-evaluation-controls.js"
  );
  initializeTextQualityControl();

}

function createServer(app: Application): http.Server {
  return http.createServer(app);
}

function startServer(server: http.Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("error", onError);
      reject(error);
    };

    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      console.log(`Server listening on ${host}:${port}`);
      resolve();
    });
  });
}

export async function startup(port: unknown): Promise<http.Server> {
  assertSafeAdminCredentialsForStartup();

  const resolvedPort = resolvePort(port);
  const resolvedHost = resolveHost(process.env.HOST);

  const databaseConnected = await testDatabaseConnection();
  if (databaseConnected) {
    await bootstrapDatabaseDefaults();
  } else {
    console.warn(
      "Database connection test failed. Application may not function correctly.",
    );
  }

  const app = createApp();
  await initializeBackgroundServices();
  await setupRoutes(app);

  const server = createServer(app);
  await startServer(server, resolvedPort, resolvedHost);
  return server;
}
