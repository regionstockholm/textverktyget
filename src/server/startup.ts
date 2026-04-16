/**
 * Server Startup Module
 * Handles the initialization and startup of the server application
 * Manages server configuration and graceful startup with Postgres
 * Follows Power of Ten guidelines for TypeScript
 *
 * @module server/startup
 */

import assert from "assert";
import http from "http";
import { Application } from "express";

import { createApp } from "./app.js";
import { setupRoutes } from "./routes.js";
import { testConnection } from "../config/database/db-connection.js";
import { ensureTaskPromptDefaults } from "../services/tasks/task-prompt-bootstrap-service.js";
import { initializeAutoProfileController } from "../services/summarize/auto-profile-controller.js";
import { applyDefaultConfigIfDatabaseEmpty } from "../services/config/default-config-bootstrap-service.js";

// Constants for server configuration
const SERVER_CONSTANTS = Object.freeze({
  // Default port if not specified
  DEFAULT_PORT: 3000,
  // Maximum port number
  MAX_PORT: 65535,
  // Minimum port number
  MIN_PORT: 1024,
  // Database connection timeout in milliseconds
  DB_CONNECT_TIMEOUT: 10000,
  // Default host binding for container/runtime compatibility
  DEFAULT_HOST: "0.0.0.0",
  // Maximum number of database connection attempts
  MAX_DB_CONNECT_ATTEMPTS: 3,
  // Delay between connection attempts in milliseconds
  DB_CONNECT_RETRY_DELAY: 2000,
});

/**
 * Validates the port number
 * @param port The port number to validate
 * @returns The validated port number
 * @throws {Error} If port is invalid
 */
function validatePort(port: unknown): number {
  // If port is not provided or is NaN, use default port
  if (port === undefined || port === null || Number.isNaN(Number(port))) {
    console.log(
      `Port not specified or invalid, using default port ${SERVER_CONSTANTS.DEFAULT_PORT}`,
    );
    return SERVER_CONSTANTS.DEFAULT_PORT;
  }

  const numPort = Number(port);

  // Validate port is in valid range
  assert(
    Number.isInteger(numPort) &&
      numPort >= SERVER_CONSTANTS.MIN_PORT &&
      numPort <= SERVER_CONSTANTS.MAX_PORT,
    `Port must be an integer between ${SERVER_CONSTANTS.MIN_PORT} and ${SERVER_CONSTANTS.MAX_PORT}`,
  );

  return numPort;
}


function validateHost(host: unknown): string {
  if (typeof host !== "string" || host.trim().length === 0) {
    return SERVER_CONSTANTS.DEFAULT_HOST;
  }

  return host.trim();
}

/**
 * Tests the Postgres database connection
 * @returns Promise<boolean> True if connection is successful
 */
async function testDatabaseConnection(): Promise<boolean> {
  console.log(`Testing Postgres database connection...`);

  let attempts = 0;

  while (attempts < SERVER_CONSTANTS.MAX_DB_CONNECT_ATTEMPTS) {
    attempts++;

    try {
      console.log(
        `Attempting database connection test (attempt ${attempts})...`,
      );

      // Test database connection with timeout
      const connectionPromise = testConnection();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Database connection test timeout"));
        }, SERVER_CONSTANTS.DB_CONNECT_TIMEOUT);
      });

      const isConnected = await Promise.race([
        connectionPromise,
        timeoutPromise,
      ]);

      if (isConnected) {
        console.log("Postgres database connection test successful");
        return true;
      } else {
        throw new Error("Database connection test failed");
      }
    } catch (error) {
      console.error(
        `Database connection test failed (attempt ${attempts}):`,
        error,
      );

      if (attempts >= SERVER_CONSTANTS.MAX_DB_CONNECT_ATTEMPTS) {
        console.error(
          `Failed to connect to Postgres database after ${SERVER_CONSTANTS.MAX_DB_CONNECT_ATTEMPTS} attempts`,
        );
        return false;
      }

      // Wait before retrying
      console.log(
        `Retrying in ${SERVER_CONSTANTS.DB_CONNECT_RETRY_DELAY / 1000} seconds...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, SERVER_CONSTANTS.DB_CONNECT_RETRY_DELAY),
      );
    }
  }

  return false;
}

/**
 * Creates and configures the HTTP server
 * @param app Express application
 * @returns HTTP server instance
 */
function createServer(app: Application): http.Server {
  assert(app, "Express application is required");

  const server = http.createServer(app);
  assert(server, "Failed to create HTTP server");

  return server;
}

/**
 * Starts the server and listens on the specified port
 * @param server HTTP server instance
 * @param port Port to listen on
 * @returns Promise that resolves when server starts listening
 */
async function startServer(
  server: http.Server,
  port: number,
  host: string,
): Promise<void> {
  assert(server, "HTTP server is required");
  assert(
    Number.isInteger(port) &&
      port >= SERVER_CONSTANTS.MIN_PORT &&
      port <= SERVER_CONSTANTS.MAX_PORT,
    `Port must be an integer between ${SERVER_CONSTANTS.MIN_PORT} and ${SERVER_CONSTANTS.MAX_PORT}`,
  );
  assert(typeof host === "string" && host.length > 0, "Host must be set");

  return new Promise((resolve, reject) => {
    try {
      server.listen(port, host, () => {
        console.log(`Server listening on ${host}:${port}`);
        resolve();
      });

      server.on("error", (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Initializes and starts the server
 * @param port Port to listen on
 * @returns Promise<http.Server> HTTP server instance
 * @throws {Error} If startup fails
 */
export async function startup(port: unknown): Promise<http.Server> {
  try {
    console.log("Starting server...");

    // Validate port and host
    const validatedPort = validatePort(port);
    const validatedHost = validateHost(process.env.HOST);

    // Test Postgres database connection
    console.log("Testing Postgres database connection...");
    const dbConnected = await testDatabaseConnection();

    if (!dbConnected) {
      console.warn(
        "Database connection test failed. Application may not function correctly.",
      );
    } else {
      try {
        const bootstrapResult = await applyDefaultConfigIfDatabaseEmpty("startup");
        if (bootstrapResult.applied) {
          console.log(
            `[Startup] Applied default config (${bootstrapResult.tasksCreated} tasks, ${bootstrapResult.promptsCreated} prompts, ${bootstrapResult.ordlistaCreated} ordlista entries)`,
          );
        } else {
          console.log("[Startup] Default config bootstrap skipped (existing data found)");
        }

        const result = await ensureTaskPromptDefaults("startup");
        if (result.created > 0) {
          console.log(
            `[Startup] Ensured task prompts for ${result.checked} tasks (${result.created} created)`,
          );
        } else {
          console.log(
            `[Startup] Task prompts already present for ${result.checked} tasks`,
          );
        }
      } catch (error) {
        console.error("[Startup] Failed to ensure task prompt defaults:", error);
      }
    }

    // Create Express application
    console.log("Creating Express application...");
    const app = createApp();

    // Log app details before setting up routes
    console.log("Express app created:", {
      appExists: app !== null && app !== undefined,
      appType: typeof app,
      appConstructorName: app.constructor ? app.constructor.name : "unknown",
      hasMethods: {
        use: typeof app.use === "function",
        get: typeof app.get === "function",
        post: typeof app.post === "function",
      },
    });

    // Initialize text quality control and cleanup service
    console.log("Initializing text quality control cleanup service...");
    const { initializeTextQualityControl } = await import(
      "../services/quality-evaluation-controls.js"
    );
    initializeTextQualityControl();

    // Initialize file cleanup service
    console.log("Initializing file cleanup service...");
    const { startCleanupService } = await import(
      "../services/upload/file-cleanup-service.js"
    );
    startCleanupService();

    // Initialize adaptive quality/stress profile controller
    console.log("Initializing auto profile controller...");
    initializeAutoProfileController();

    // Set up routes
    console.log("Setting up routes...");
    await setupRoutes(app);

    // Create HTTP server
    const server = createServer(app);

    // Start server
    await startServer(server, validatedPort, validatedHost);

    console.log("Server started successfully with Postgres database");

    return server;
  } catch (error) {
    console.error("Server startup failed:", error);
    throw error;
  }
}
