/** A big thank you to:
- Fredrik Aldegren
- Rodolfo Alvarez Rosas
- Anneli Utas
- Anna Lundin Almqvist 
- Carl Eckstein
- and everyone who have tested and supported this project
*/

/**
 * Express Application Configuration Module
 * Sets up and configures the Express application with all necessary middleware,
 * security settings, and request handling capabilities.
 *
 * @module server/app
 */

import express, { Application } from "express";
import assert from "assert";

// Import security and CORS configurations
import configureHelmet from "../config/security/helmet-config.js";
import configureCors from "../config/security/cors-config.js";

// Import custom middleware
import { setSecurityHeaders } from "../routes/static/middleware/security-headers.js";
import { developmentLogger } from "../middleware/logger.js";
import { config } from "../config/app-config.js";

/**
 * Simple payload size verification
 * @param req - Request object
 * @param res - Response object
 * @param buf - Buffer to check
 */
function verifyPayloadSize(_req: any, _res: any, buf: Buffer): void {
  const maxBytes = config.security.maxFileSizeMB * 1024 * 1024;

  if (buf.length > maxBytes) {
    throw new Error(
      `File size ${buf.length} bytes exceeds limit of ${maxBytes} bytes`,
    );
  }
}

/**
 * Configure request body parsing
 * @param app - Express application
 */
function configureBodyParsing(app: Application): void {
  app.use(
    express.json({
      limit: config.security.maxFileSize,
      verify: verifyPayloadSize,
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: config.security.maxFileSize,
    }),
  );
}

/**
 * Configures proxy settings for standard operation
 *
 * @function configureProxy
 * @param {Application} app - Express application instance
 */
function configureProxy(app: Application): void {
  assert(app, "Express application is required");

  // Set trust proxy to 1 (standard for production behind reverse proxy)
  app.set("trust proxy", 1);
  console.log("Trust proxy set to 1");
}

/**
 * Creates and configures an Express application instance
 *
 * @returns {Application} Configured Express application
 * @throws {Error} If configuration fails or parameters are invalid
 */
export function createApp(): Application {
  try {
    const app = express();

    if (!app) {
      throw new Error("Failed to create Express application");
    }

    // Configure proxy settings
    configureProxy(app);

    // Apply security configurations and CORS settings
    configureHelmet(app);
    configureCors(app);

    // Enable request logging (standard logger, was previously called developmentLogger)
    app.use(developmentLogger);
    console.log("Request logging enabled");

    // Configure request body parsing with size limits for security
    configureBodyParsing(app);

    // Cookie parsing and session handling removed - no longer needed for user authentication

    // Apply custom security headers
    app.use(setSecurityHeaders);

    console.log("Express application configured successfully");
    return app;
  } catch (error) {
    console.error("Failed to create Express application:", error);
    throw error;
  }
}
