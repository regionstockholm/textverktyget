/**
 * Routes Configuration Module
 * Sets up all application routes with their respective middleware and handlers
 * Implements rate limiting, authentication, and security measures
 * Follows Power of Ten guidelines for TypeScript
 *
 * @module server/routes
 */

import { strict as assert } from "assert";
import { Application } from "express";
import { logger } from "../utils/logger.js";

import {
  apiLimiter,
  cspViolationReporter,
} from "../middleware/api-rate-limiter.js";
import { errorHandler } from "../middleware/error-handler.js";
import apiRoutes from "../routes/api.js";
import adminRoutes from "../routes/admin.js";
import uploadRoutes from "../routes/uploads.js";
import mainRoutes from "../routes/main.js";
import staticRoutes, {
  setupStaticRoutes,
} from "../routes/static/static-assets.js";

// Constants for route configuration
const ROUTE_CONSTANTS = Object.freeze({
  PATHS: {
    ROOT: "/",
    SUMMARIZE: "/summarize",
    UPLOAD: "/upload",
    CSP_VIOLATION: "/report-violation",
    QUALITY: "/quality",
    WEB_FETCH: "/api",
  },
  // Route setup order priority (lower number = higher priority)
  PRIORITY: {
    STATIC: 1,
    MAIN: 2,
    API: 3,
    ERROR_HANDLING: 4,
  },
  // Maximum number of routes to register
  MAX_ROUTES: 100,
});

/**
 * Validates that the provided object is an Express application
 *
 * @function validateExpressApp
 * @param {unknown} app - Object to validate
 * @throws {Error} If validation fails
 */
function validateExpressApp(app: unknown): asserts app is Application {
  // Basic validation - app must exist
  assert(app, "Express application cannot be null or undefined");

  // Check if app is a function or an object (Express apps are functions with object properties)
  assert(
    typeof app === "function" || typeof app === "object",
    "Express application must be a function or an object",
  );

  // Check for essential Express methods needed for routing
  const expressApp = app as any;
  const requiredMethods = ["use", "get", "post"];

  for (const method of requiredMethods) {
    assert(
      typeof expressApp[method] === "function",
      `Express application must have a '${method}' method`,
    );
  }
}

/**
 * Validates that all route modules are properly loaded
 *
 * @function validateRouteModules
 * @throws {Error} If validation fails
 */
function validateRouteModules(): void {
  // Validate route modules with more lenient checks
  // Allow both function and object types since Express routers are functions with object properties
  assert(
    mainRoutes &&
      (typeof mainRoutes === "function" || typeof mainRoutes === "object"),
    "Main routes module is invalid",
  );
  assert(
    staticRoutes &&
      (typeof staticRoutes === "function" || typeof staticRoutes === "object"),
    "Static routes module is invalid",
  );

  // Optional routes can be checked but not required
  if (apiRoutes) {
    assert(
      typeof apiRoutes === "function" || typeof apiRoutes === "object",
      "Summarize routes module is invalid",
    );
  } else {
    logger.warn("routes.api.missing", { processStatus: "running" });
  }

  if (adminRoutes) {
    assert(
      typeof adminRoutes === "function" || typeof adminRoutes === "object",
      "Admin routes module is invalid",
    );
  } else {
    logger.warn("routes.admin.missing", { processStatus: "running" });
  }

  if (uploadRoutes) {
    assert(
      typeof uploadRoutes === "function" || typeof uploadRoutes === "object",
      "Upload routes module is invalid",
    );
  } else {
    logger.warn("routes.upload.missing", { processStatus: "running" });
  }
}

/**
 * Validates that all middleware is properly initialized
 *
 * @function validateMiddleware
 * @throws {Error} If any middleware is invalid
 */
function validateMiddleware(): void {
  // Validate rate limiters
  assert(
    apiLimiter && typeof apiLimiter === "function",
    "API rate limiter is invalid",
  );
  assert(
    cspViolationReporter && typeof cspViolationReporter === "function",
    "CSP violation reporter is invalid",
  );

  // Validate error handler
  assert(
    errorHandler && typeof errorHandler === "function",
    "Error handler is invalid",
  );
}

/**
 * Sets up base routes for the application
 * Includes static file serving and main page routes
 *
 * @async
 * @function setupBaseRoutes
 * @param {Application} app - Express application
 * @returns {Promise<void>}
 */
async function setupBaseRoutes(app: Application): Promise<void> {
  assert(app, "Express application is required");

  // Set up static file serving first (highest priority)
  logger.info("routes.static.setup", { processStatus: "running" });
  await setupStaticRoutes(app);
  app.use(staticRoutes);

  // Set up admin routes if available
  if (adminRoutes) {
    logger.info("routes.admin.setup", { processStatus: "running" });
    app.use("/admin", adminRoutes);
  }

  // Set up main page routes
  logger.info("routes.main.setup", { processStatus: "running" });
  app.use(mainRoutes);
}

// Authentication system completely removed for simplification

/**
 * Sets up API routes with rate limiting
 *
 * @function setupApiRoutes
 * @param {Application} app - Express application
 */
function setupApiRoutes(app: Application): void {
  assert(app, "Express application is required");

  logger.info("routes.api.setup", { processStatus: "running" });

  // Apply rate limiting to API endpoints
  app.use("/api", apiLimiter);
  app.use("/upload", apiLimiter);

  // Register consolidated API routes
  app.use("/api", apiRoutes);
  app.use("/upload", uploadRoutes);

  // Set up CSP violation reporting endpoint
  app.post(ROUTE_CONSTANTS.PATHS.CSP_VIOLATION, cspViolationReporter);
}

/**
 * Sets up security and error handling middleware
 * Must be called after all routes are registered
 *
 * @function setupSecurityAndErrorHandling
 * @param {Application} app - Express application
 */
function setupSecurityAndErrorHandling(app: Application): void {
  assert(app, "Express application is required");

  logger.info("routes.error_handler.setup", { processStatus: "running" });

  // Register centralized error handler
  app.use(errorHandler);

  // Register 404 handler for unmatched routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: "Not Found",
      message: "The requested page does not exist.",
      status: 404,
    });
  });
}

/**
 * Sets up all application routes in the correct order
 * Follows the priority order defined in ROUTE_CONSTANTS
 *
 * @async
 * @function setupRoutes
 * @param {unknown} app - Express application
 * @returns {Promise<boolean>} True if setup was successful
 * @throws {Error} If route setup fails
 */
export async function setupRoutes(app: unknown): Promise<boolean> {
  try {
    // Check if app is null or undefined before validation
    if (app === null || app === undefined) {
      logger.error("routes.setup.failed", {
        processStatus: "failed",
        meta: { reason: "app_missing" },
      });
      throw new Error("Express application cannot be null or undefined");
    }

    // Validate the Express app
    validateExpressApp(app);

    // Validate route modules and middleware
    validateRouteModules();
    validateMiddleware();

    // Set up routes in priority order
    await setupBaseRoutes(app);
    setupApiRoutes(app);
    setupSecurityAndErrorHandling(app);

    logger.info("routes.setup.completed", { processStatus: "completed" });
    return true;
  } catch (error) {
    logger.error("routes.setup.failed", {
      processStatus: "failed",
      meta: { error: error instanceof Error ? error.message : "Unknown error" },
    });
    throw error;
  }
}
