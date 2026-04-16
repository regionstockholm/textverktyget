/**
 * Server Entry Point
 * Initializes and starts the application server with all required components
 * Handles environment configuration, database connections, and route setup
 *
 * @module server
 */

import assert from "assert";

// Import server components
import { startup } from "./server/startup.js";
import { setupUploadsDirectory, logEnvironmentInfo } from "./server/init.js";

// Import services
// Session cleanup will be handled by startup.ts

// Constants for server configuration
const SERVER_CONSTANTS = Object.freeze({
  DEFAULT_PORT: 3000,
  EXIT_CODES: {
    INITIALIZATION_ERROR: 1,
    DATABASE_ERROR: 2,
    RUNTIME_ERROR: 3,
  },
  STARTUP_PHASES: {
    ENVIRONMENT_CHECK: "Environment Check",
    DIRECTORY_SETUP: "Directory Setup",
    ROUTES_SETUP: "Routes Setup",
    SERVER_START: "Server Start",
  },
});

/**
 * Initializes the server with all required components
 * Coordinates startup sequence including environment setup,
 * directory creation, route configuration, and server startup
 *
 * @async
 * @function initializeServer
 * @returns {Promise<void>} Resolves when startup sequence completes
 * @throws {Error} If server initialization fails
 */
async function initializeServer(): Promise<void> {
  let currentPhase = SERVER_CONSTANTS.STARTUP_PHASES.ENVIRONMENT_CHECK;

  try {
    // Log environment information
    logEnvironmentInfo();

    // Validate port configuration
    const port = process.env.PORT
      ? parseInt(process.env.PORT, 10)
      : SERVER_CONSTANTS.DEFAULT_PORT;
    assert(!isNaN(port) && port > 0, `Invalid port: ${process.env.PORT}`);

    // Database connection will be handled by the startup function
    console.log("Database connection will be handled during server startup");

    currentPhase = SERVER_CONSTANTS.STARTUP_PHASES.DIRECTORY_SETUP;
    // Initialize server components
    const uploadsPath = await setupUploadsDirectory();
    console.log(`Uploads directory configured at: ${uploadsPath}`);

    currentPhase = SERVER_CONSTANTS.STARTUP_PHASES.ROUTES_SETUP;
    // Session cleanup will be handled by the startup function
    console.log("Session cleanup will be handled during server startup");

    currentPhase = SERVER_CONSTANTS.STARTUP_PHASES.SERVER_START;
    // Start the server using the startup function - this will handle routes setup
    await startup(port);

    return;
  } catch (error) {
    console.error(`Failed during ${currentPhase} phase:`, error);

    // Determine appropriate exit code based on failure phase
    const exitCode = SERVER_CONSTANTS.EXIT_CODES.INITIALIZATION_ERROR;

    // Allow time for logs to be written before exit
    setTimeout(() => {
      process.exit(exitCode);
    }, 100);

    // Re-throw to allow for potential external handling
    throw error;
  }
}

// Initialize and start the server with proper error handling
initializeServer().catch((error) => {
  console.error("Fatal server initialization error:", error);

  // Allow time for logs to be written before exit
  setTimeout(() => {
    process.exit(SERVER_CONSTANTS.EXIT_CODES.INITIALIZATION_ERROR);
  }, 100);
});
