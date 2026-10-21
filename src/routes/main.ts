/**
 * Main Application Routes
 * Handles primary pages and content serving
 */

import express from "express";
import type { Request, Response } from "express";
import { join } from "path";
import { apiLimiter } from "../middleware/api-rate-limiter.js";
import { safeReadFile } from "../utils/file/file-reader.js";
import {
  generateSecureNonce,
  generateCSPDirectives,
} from "../utils/security/csp-utils.js";
import { config } from "../config/app-config.js";
import { isUserLoginEnabled } from "../config/security/access-config.js";
import { hasAdminSession } from "../auth/admin-session.js";
import { versionAdminScript } from "../utils/file/admin-script-version.js";

const router = express.Router();

router.get(["/login", "/login.html"], async (_req, res) => {
  if (!isUserLoginEnabled()) {
    res.redirect("/");
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    res.send(
      await safeReadFile(join(process.cwd(), "public", "login.html"), "utf8"),
    );
  } catch {
    res.status(500).send("Error loading login page");
  }
});

/**
 * GET /
 * Main application page with CSP security headers
 */
router.get(
  ["/", "/index.html"],
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const indexPath = join(process.cwd(), "public", "index.html");
      let indexHtml = await safeReadFile(indexPath, "utf8");

      // Clean up initialization elements
      indexHtml = indexHtml.replace('<div class="initialize"></div>', "");

      // Add CSP nonce for scripts
      const nonce = generateSecureNonce();
      indexHtml = indexHtml.replace(/<script>/g, `<script nonce="${nonce}">`);

      // Generate and set CSP header
      const cspHeader = generateCSPDirectives(nonce);
      res.setHeader("Content-Security-Policy", cspHeader);

      res.send(indexHtml);
    } catch (error) {
      console.error("Error serving main page:", error);

      const errorMessage = "Error loading page";
      res.status(500).send(errorMessage);
    }
  },
);

/**
 * GET /admin-ui
 * Admin interface page with CSP security headers
 */
router.get(
  ["/admin-ui", "/admin-ui.html"],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const name = hasAdminSession(req) ? "admin-ui" : "admin-login";
      const adminPath = join(process.cwd(), "public", `${name}.html`);
      let adminHtml = await safeReadFile(adminPath, "utf8");
      adminHtml = adminHtml.replace(
        "__USERS_NAV_HIDDEN__",
        isUserLoginEnabled() ? "" : "hidden",
      );
      res.setHeader("Cache-Control", "no-store, no-transform");

      const nonce = generateSecureNonce();
      adminHtml = adminHtml.replaceAll("__CSP_NONCE__", nonce);
      adminHtml = await versionAdminScript(adminHtml, name);

      const cspHeader = generateCSPDirectives(nonce);
      res.setHeader("Content-Security-Policy", cspHeader);

      res.send(adminHtml);
    } catch (error) {
      console.error("Error serving admin UI:", error);

      const errorMessage = "Error loading admin page";
      res.status(500).send(errorMessage);
    }
  },
);

/**
 * GET /api/content
 * API endpoint for fetching application content
 */
router.get(
  "/api/content",
  apiLimiter,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const contentPath = join(process.cwd(), "src", "views", "content.html");
      const content = await safeReadFile(contentPath, "utf8");
      res.send(content);
    } catch (error) {
      console.error("Error reading content file:", error);

      const errorResponse = {
        error: "Error loading content",
      };

      res.status(500).json(errorResponse);
    }
  },
);

/**
 * GET /health
 * Docker and monitoring need this endpoint in both local and production mode.
 */
router.get("/health", (_req: Request, res: Response): void => {
  try {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "postgres",
      features: {
        qualityEvaluation: config.features.qualityEvaluation,
        fileUpload: config.features.fileUpload,
        webFetch: config.features.webFetch,
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Service unavailable",
    });
  }
});

export default router;
