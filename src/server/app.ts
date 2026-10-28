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

import express from "express";
import type { Application } from "express";

import configureHelmet from "../config/security/helmet-config.js";

// Import custom middleware
import { setSecurityHeaders } from "../routes/static/middleware/security-headers.js";
import { requestLogger } from "../middleware/logger.js";
import { config } from "../config/app-config.js";
import { isCloudflareEnabled } from "../config/security/access-config.js";
import { configureSession } from "../config/security/session-config.js";
import { userBackupImportParser } from "../routes/admin/user-backup-routes.js";

/**
 * Configure request body parsing
 * @param app - Express application
 */
function configureBodyParsing(app: Application): void {
  app.post("/admin/user-backup/import", userBackupImportParser);
  const bodyParsers = express.Router();
  // Login routes apply their own small parsers after the authentication throttle.
  bodyParsers.post(["/auth/login", "/admin/login"], (_req, _res, next) => next("router"));
  const parseJson = express.json({ limit: config.security.maxFileSize });
  // Document JSON is parsed after authentication/rate limiting, with base64 overhead.
  bodyParsers.use((req, res, next) => {
    if (req.method === "POST" && req.path.toLowerCase().replace(/\/+$/, "") === "/upload/process-document") next();
    else parseJson(req, res, next);
  });

  bodyParsers.use(
    express.urlencoded({
      extended: true,
      limit: config.security.maxFileSize,
    }),
  );
  app.use(bodyParsers);
}

/**
 * Configures proxy settings for standard operation
 *
 * @function configureProxy
 * @param {Application} app - Express application instance
 */
function configureProxy(app: Application): void {
  // The tunnel is the only supported forwarding hop; keep the origin private.
  app.set("trust proxy", isCloudflareEnabled() ? 1 : false);
}

/**
 * Creates and configures an Express application instance
 *
 * @returns {Application} Configured Express application
 */
export function createApp(): Application {
  const app = express();

  configureProxy(app);
  configureHelmet(app);

  app.use(requestLogger);
  console.log("Request logging enabled");

  configureBodyParsing(app);
  configureSession(app);
  app.use(setSecurityHeaders);

  console.log("Express application configured successfully");
  return app;
}
