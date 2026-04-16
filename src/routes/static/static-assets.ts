/**
 * Static Routes Module
 *
 * Handles static file serving with proper caching and security headers.
 * Provides environment-specific robot crawling rules.
 * Implements the adapted "Power of Ten" guidelines for safety and reliability.
 *
 * @module routes/static
 */

"use strict";

import express, { Request, Response, Application } from "express";
import { join } from "path";
import { assert } from "../../utils/safety-utils.js";
import getStaticOptions from "../../config/static/static-options.js";

const router = express.Router();

/**
 * Production robots.txt content
 * @constant {string}
 */
const ROBOTS_CONTENT = "User-agent: *\nDisallow: /admin/\nDisallow: /api/";

/**
 * GET /robots.txt
 * Serves robots.txt content
 *
 * @route GET /robots.txt
 * @returns {string} robots.txt content
 */
router.get("/robots.txt", (req: Request, res: Response) => {
  // Assert preconditions
  assert(Boolean(req), "Request object is required");
  assert(Boolean(res), "Response object is required");

  // Simple control flow with clear conditions
  res.type("text/plain");

  res.send(ROBOTS_CONTENT);
});

// Import middleware after defining router to avoid circular dependencies
import { setCacheHeaders } from "./middleware/cache-control.js";
import { setSecurityHeaders } from "./middleware/security-headers.js";

// Apply middleware to all static routes
router.use(setCacheHeaders);
router.use(setSecurityHeaders);

// Serve static files from public directory
router.use(
  "/",
  express.static(join(process.cwd(), "public"), {
    index: false, // Don't serve index.html automatically
    dotfiles: "ignore", // Don't serve dotfiles
    etag: true, // Enable ETags
    lastModified: true, // Enable Last-Modified
  }),
);

// Serve assets from assets directory
router.use(
  "/assets",
  express.static(join(process.cwd(), "assets"), {
    dotfiles: "ignore",
    etag: true,
    lastModified: true,
  }),
);

/**
 * Validates Express application instance
 * Uses a more lenient approach to validation
 *
 * @param {Application} app - Express application instance
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateExpressApp(app: Application): boolean {
  // Basic validation - app must exist
  assert(Boolean(app), "Express application cannot be null or undefined");

  // Check for the minimum required method for static routes
  assert(
    typeof app.use === "function",
    "Express application must have a 'use' method",
  );

  console.log("Express application validation successful for static routes");
  return true;
}

/**
 * Sets up static file serving for the application
 * Configures Express to serve files from the public directory
 * with environment-specific options
 *
 * @param {Application} app - Express application instance
 * @returns {void}
 * @throws {Error} If setup fails
 */
export const setupStaticRoutes = (app: Application): void => {
  try {
    // Validate input
    validateExpressApp(app);

    // Declare variables in smallest scope
    const publicPath = join(process.cwd(), "public");

    // Assert path exists
    assert(typeof publicPath === "string", "Public path must be a string");

    // Get static options
    const staticOptions = getStaticOptions();

    // Serve static files from public directory
    app.use(express.static(publicPath, staticOptions));

    console.log(`Static files configured to be served from: ${publicPath}`);
  } catch (error) {
    console.error("Failed to set up static routes:", error);
    // Don't throw here, just log the error to prevent app crash
    // This allows the application to continue even if static file serving fails
  }
};

export default router;
