/**
 * Server Shutdown Module
 * Handles the graceful shutdown of the server and cleanup of resources
 * Manages active connections, database connections, and process termination
 * Follows Power of Ten guidelines for TypeScript
 *
 * @module server/shutdown
 */

import { closeDatabase } from "../config/database/db-connection.js";
import { disconnectPrismaClient } from "../config/database/prisma-client.js";

// Type for shutdown reason
type ShutdownReason =
  | "SIGINT"
  | "SIGTERM"
  | "uncaughtException"
  | "unhandledRejection"
  | "manual"
  | "error";

// Constants for shutdown configuration
const SHUTDOWN_CONSTANTS = Object.freeze({
  // Timeout for graceful shutdown in milliseconds
  SHUTDOWN_TIMEOUT: 30000,
  // Maximum number of shutdown attempts
  MAX_SHUTDOWN_ATTEMPTS: 3,
  // Delay between shutdown attempts in milliseconds
  SHUTDOWN_RETRY_DELAY: 5000,
});

// Shutdown in progress flag
let isShuttingDown = false;

/**
 * Closes the Postgres database connection gracefully
 *
 * @async
 * @function closeDatabaseConnection
 * @returns {Promise<void>}
 */
async function closeDatabaseConnection(): Promise<void> {
  try {
    console.log("Closing Postgres database connection...");
    await closeDatabase();
    await disconnectPrismaClient();
    console.log("Postgres database connection closed successfully");
  } catch (error) {
    console.error("Error closing Postgres database connection:", error);
    throw error;
  }
}

/**
 * Performs cleanup operations before shutdown
 *
 * @async
 * @function cleanup
 * @returns {Promise<void>}
 */
async function cleanup(): Promise<void> {
  try {
    console.log("Performing cleanup operations...");

    // Stop file cleanup service
    try {
      const { stopCleanupService } = await import(
        "../services/upload/file-cleanup-service.js"
      );
      stopCleanupService();
    } catch (error) {
      console.error("Error stopping file cleanup service:", error);
    }

    console.log("Cleanup operations completed");
  } catch (error) {
    console.error("Error during cleanup:", error);
    throw error;
  }
}

/**
 * Shuts down the server gracefully
 *
 * @async
 * @function shutdown
 * @param {ShutdownReason} reason - Reason for shutdown
 * @returns {Promise<void>}
 */
export async function shutdown(reason: ShutdownReason): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    console.log("Shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  console.log(`Shutting down server (reason: ${reason})...`);

  let shutdownAttempts = 0;

  while (shutdownAttempts < SHUTDOWN_CONSTANTS.MAX_SHUTDOWN_ATTEMPTS) {
    shutdownAttempts++;

    try {
      console.log(`Shutdown attempt ${shutdownAttempts}...`);

      await closeDatabaseConnection().catch((error) => {
        console.error("Error closing database connection:", error);
      });

      // Perform cleanup operations
      await cleanup();

      console.log("Shutdown completed successfully");
      return;
    } catch (error) {
      console.error(`Shutdown attempt ${shutdownAttempts} failed:`, error);

      if (shutdownAttempts >= SHUTDOWN_CONSTANTS.MAX_SHUTDOWN_ATTEMPTS) {
        console.error(
          `Failed to shutdown gracefully after ${SHUTDOWN_CONSTANTS.MAX_SHUTDOWN_ATTEMPTS} attempts`,
        );
        return;
      }

      console.log(
        `Retrying shutdown in ${
          SHUTDOWN_CONSTANTS.SHUTDOWN_RETRY_DELAY / 1000
        } seconds...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, SHUTDOWN_CONSTANTS.SHUTDOWN_RETRY_DELAY),
      );
    }
  }
}
