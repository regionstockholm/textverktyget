/**
 * Server Initialization Module
 * Handles the initialization of the server and environment setup
 * Manages environment variables, command line arguments, and server startup
 * Follows Power of Ten guidelines for TypeScript
 *
 * @module server/init
 */

import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { startup } from "./startup.js";
import { shutdown } from "./shutdown.js";
import { testConnection } from "../config/database/db-connection.js";

// Constants for initialization
const INIT_CONSTANTS = Object.freeze({
  // Environment variable names
  ENV_VARS: {
    PORT: "PORT",
  },
  // Maximum number of startup attempts
  MAX_STARTUP_ATTEMPTS: 3,
  // Delay between startup attempts in milliseconds
  STARTUP_RETRY_DELAY: 5000,
  // Exit codes
  EXIT_CODES: {
    SUCCESS: 0,
    GENERAL_ERROR: 1,
    INVALID_ARGUMENT: 2,
    ENVIRONMENT_ERROR: 3,
    STARTUP_ERROR: 4,
  },
  // Directory permissions (0o750 = rwxr-x---)
  UPLOAD_DIR_PERMISSIONS: 0o750,
  // Maximum retries for directory creation
  MAX_DIR_CREATE_RETRIES: 3,
  // Delay between retries in milliseconds
  RETRY_DELAY_MS: 500,
});

// Type for command line arguments
interface CommandLineArgs {
  port?: string | number;
}

/**
 * Parses command line arguments
 *
 * @function parseCommandLineArgs
 * @returns {CommandLineArgs} Parsed command line arguments
 */
function parseCommandLineArgs(): CommandLineArgs {
  const args: CommandLineArgs = {};

  // Skip first two arguments (node executable and script path)
  const processArgs = process.argv.slice(2);

  // Parse command line arguments
  for (let i = 0; i < processArgs.length; i++) {
    const arg = processArgs[i];

    if (arg === "--port" || arg === "-p") {
      // Get port argument
      if (i + 1 < processArgs.length) {
        args.port = processArgs[++i];
      }
    }
  }

  return args;
}

/**
 * Gets the port from command line arguments or environment variables
 *
 * @function getPort
 * @param {CommandLineArgs} args - Command line arguments
 * @returns {number | undefined} The port to use, or undefined if not specified
 */
function getPort(args: CommandLineArgs): number | undefined {
  // Try to get port from command line arguments
  if (args.port !== undefined) {
    const port = Number(args.port);
    if (!Number.isNaN(port)) {
      console.log(`Using port from command line: ${port}`);
      return port;
    }
    console.warn(`Invalid port from command line: ${args.port}`);
  }

  // Try to get port from environment variables
  const envPort = process.env[INIT_CONSTANTS.ENV_VARS.PORT];
  if (envPort) {
    const port = Number(envPort);
    if (!Number.isNaN(port)) {
      console.log(`Using port from environment variables: ${port}`);
      return port;
    }
    console.warn(`Invalid port from environment variables: ${envPort}`);
  }

  // Return undefined to let the server use its default port
  console.log("No valid port specified, server will use default port");
  return undefined;
}

/**
 * Sets up process event handlers for graceful shutdown
 *
 * @function setupProcessHandlers
 * @param {NodeJS.Process} process - Node.js process
 */
function setupProcessHandlers(process: NodeJS.Process): void {
  assert(process, "Process is required");

  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", () => {
    console.log("Received SIGINT signal");
    shutdown("SIGINT")
      .then(() => {
        console.log("Shutdown complete");
        process.exit(INIT_CONSTANTS.EXIT_CODES.SUCCESS);
      })
      .catch((error: Error) => {
        console.error("Error during shutdown:", error);
        process.exit(INIT_CONSTANTS.EXIT_CODES.GENERAL_ERROR);
      });
  });

  // Handle SIGTERM (kill)
  process.on("SIGTERM", () => {
    console.log("Received SIGTERM signal");
    shutdown("SIGTERM")
      .then(() => {
        console.log("Shutdown complete");
        process.exit(INIT_CONSTANTS.EXIT_CODES.SUCCESS);
      })
      .catch((error: Error) => {
        console.error("Error during shutdown:", error);
        process.exit(INIT_CONSTANTS.EXIT_CODES.GENERAL_ERROR);
      });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    console.error("Uncaught exception:", error);
    shutdown("uncaughtException")
      .then(() => {
        console.log("Shutdown complete");
        process.exit(INIT_CONSTANTS.EXIT_CODES.GENERAL_ERROR);
      })
      .catch((shutdownError: Error) => {
        console.error("Error during shutdown:", shutdownError);
        process.exit(INIT_CONSTANTS.EXIT_CODES.GENERAL_ERROR);
      });
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: unknown) => {
    console.error("Unhandled promise rejection:", reason);
    shutdown("unhandledRejection")
      .then(() => {
        console.log("Shutdown complete");
        process.exit(INIT_CONSTANTS.EXIT_CODES.GENERAL_ERROR);
      })
      .catch((error: Error) => {
        console.error("Error during shutdown:", error);
        process.exit(INIT_CONSTANTS.EXIT_CODES.GENERAL_ERROR);
      });
  });
}

/**
 * Gets the path to the uploads directory
 *
 * @function getUploadsDirectoryPath
 * @returns {string} Path to the uploads directory
 */
function getUploadsDirectoryPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadsDir = path.join(path.dirname(__dirname), "uploads"); // Go up one level to src directory

  assert(
    typeof uploadsDir === "string" && uploadsDir.length > 0,
    "Invalid uploads directory path",
  );

  return uploadsDir;
}

/**
 * Creates a directory with specified permissions
 *
 * @async
 * @function createDirectory
 * @param {string} dirPath - Path to the directory to create
 * @param {number} permissions - Directory permissions
 * @returns {Promise<void>}
 * @throws {Error} If directory creation fails
 */
async function createDirectory(
  dirPath: string,
  permissions: number,
): Promise<void> {
  assert(typeof dirPath === "string", "Directory path must be a string");
  assert(typeof permissions === "number", "Permissions must be a number");

  await fs.mkdir(dirPath, {
    recursive: true,
    mode: permissions,
  });
}

/**
 * Verifies that a directory exists and is actually a directory
 *
 * @async
 * @function verifyDirectory
 * @param {string} dirPath - Path to verify
 * @returns {Promise<boolean>} True if directory exists and is valid
 * @throws {Error} If path exists but is not a directory
 */
async function verifyDirectory(dirPath: string): Promise<boolean> {
  assert(typeof dirPath === "string", "Directory path must be a string");

  const stats = await fs.stat(dirPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path exists but is not a directory: ${dirPath}`);
  }
  return true;
}

/**
 * Waits for a specified amount of time
 *
 * @async
 * @function delay
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
async function delay(ms: number): Promise<void> {
  assert(typeof ms === "number" && ms > 0, "Delay must be a positive number");
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates the uploads directory for file storage
 * Sets up a secure directory with restricted permissions
 * Directory is created at ../uploads relative to this file
 *
 * @async
 * @function setupUploadsDirectory
 * @returns {Promise<string>} Path to the created uploads directory
 * @throws {Error} If directory creation fails after retries
 */
export async function setupUploadsDirectory(): Promise<string> {
  const uploadsDir = getUploadsDirectoryPath();
  let retryCount = 0;
  let lastError: Error | null = null;

  // Attempt directory creation with retries
  while (retryCount < INIT_CONSTANTS.MAX_DIR_CREATE_RETRIES) {
    try {
      await createDirectory(uploadsDir, INIT_CONSTANTS.UPLOAD_DIR_PERMISSIONS);
      await verifyDirectory(uploadsDir);

      console.log(`Uploads directory created successfully at ${uploadsDir}`);
      console.log(
        `Directory permissions set to ${INIT_CONSTANTS.UPLOAD_DIR_PERMISSIONS.toString(
          8,
        )}`,
      );

      return uploadsDir;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `Attempt ${retryCount + 1}/${
          INIT_CONSTANTS.MAX_DIR_CREATE_RETRIES
        } - Error creating uploads directory:`,
        err,
      );

      // Wait before retrying
      await delay(INIT_CONSTANTS.RETRY_DELAY_MS);
      retryCount++;
    }
  }

  // If we reach here, all retries failed
  const errorMessage = `Failed to create uploads directory after ${INIT_CONSTANTS.MAX_DIR_CREATE_RETRIES} attempts`;
  console.error(errorMessage, lastError);
  throw new Error(errorMessage);
}

/**
 * Logs environment detection information
 * Provides visibility into the current environment configuration
 *
 * @function logEnvironmentInfo
 * @returns {void}
 */
export function logEnvironmentInfo(): void {
  console.log(`[Environment] Running in STANDARD (Production) mode`);
}

/**
 * Tests the Postgres database connection
 * Ensures the database is accessible and working
 *
 * @async
 * @function testDatabaseConnection
 * @returns {Promise<void>}
 * @throws {Error} If database connection test fails
 */
async function testDatabaseConnection(): Promise<void> {
  console.log("[Database] Starting Postgres database connection test...");

  try {
    const isConnected = await testConnection();

    if (isConnected) {
        console.log("[Database] Postgres database connection test successful");
      console.log(
        "[Database] Database structure will be initialized automatically",
      );
    } else {
      throw new Error("Database connection test failed");
    }
  } catch (error) {
    console.error("[Database] Failed to test database connection:", error);
    console.error(
      "[Database] This may indicate file system or permission issues",
    );
    throw new Error("Failed to test Postgres database connection");
  }
}

/**
 * Initializes and starts the server
 *
 * @async
 * @function init
 * @returns {Promise<void>}
 */
export async function init(): Promise<void> {
  try {
    console.log("Initializing server...");

    // Note: Environment variables are loaded via --env-file flag at startup
    // Parse command line arguments
    const args = parseCommandLineArgs();

    // Get port
    const port = getPort(args);

    // Set up process handlers for graceful shutdown
    setupProcessHandlers(process);

    // Set up uploads directory
    await setupUploadsDirectory();

    // Test Postgres database connection
    await testDatabaseConnection();

    // Start the server
    let startupAttempts = 0;

    while (startupAttempts < INIT_CONSTANTS.MAX_STARTUP_ATTEMPTS) {
      startupAttempts++;

      try {
        console.log(`Starting server (attempt ${startupAttempts})...`);
        await startup(port);

        // Log environment information
        logEnvironmentInfo();

        console.log("Server started successfully");
        return;
      } catch (error: unknown) {
        console.error(
          `Server startup failed (attempt ${startupAttempts}):`,
          error,
        );

        if (startupAttempts >= INIT_CONSTANTS.MAX_STARTUP_ATTEMPTS) {
          throw new Error(
            `Failed to start server after ${INIT_CONSTANTS.MAX_STARTUP_ATTEMPTS} attempts`,
          );
        }

        console.log(
          `Retrying in ${INIT_CONSTANTS.STARTUP_RETRY_DELAY / 1000} seconds...`,
        );
        await delay(INIT_CONSTANTS.STARTUP_RETRY_DELAY);
      }
    }

    console.log("Server initialization complete");
  } catch (error: unknown) {
    console.error("Server initialization failed:", error);
    process.exit(INIT_CONSTANTS.EXIT_CODES.STARTUP_ERROR);
  }
}

// Start the server if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  init().catch((error: Error) => {
    console.error("Unhandled error during initialization:", error);
    process.exit(INIT_CONSTANTS.EXIT_CODES.GENERAL_ERROR);
  });
}
