import type { Application } from "express";
import { logger } from "../utils/logger.js";
import {
  apiLimiter,
  cspViolationReporter,
} from "../middleware/api-rate-limiter.js";
import { errorHandler } from "../middleware/error-handler.js";
import apiRoutes from "../routes/api.js";
import adminRoutes from "../routes/admin.js";
import mainRoutes from "../routes/main.js";
import staticRoutes from "../routes/static/static-assets.js";
import uploadRoutes from "../routes/uploads.js";
import authRoutes from "../auth/routes.js";
import adminAuthRoutes from "../auth/admin-routes.js";
import { requireSameOrigin, requireUserSession } from "../auth/auth-middleware.js";
import { isUserLoginEnabled } from "../config/security/access-config.js";

function setupBaseRoutes(app: Application): void {
  // Static HTML must not bypass the main page's session guard.
  app.get(["/", "/index.html"], requireUserSession);
  app.use("/api", requireUserSession, (req, res, next) => {
    if (isUserLoginEnabled() && !["GET", "HEAD", "OPTIONS"].includes(req.method)) requireSameOrigin(req, res, next);
    else next();
  });
  app.use("/upload", requireUserSession, (req, res, next) => {
    if (isUserLoginEnabled()) requireSameOrigin(req, res, next);
    else next();
  });
  if (isUserLoginEnabled()) app.use("/auth", authRoutes);
  logger.info("routes.static.setup", { processStatus: "running" });
  app.use(staticRoutes);

  logger.info("routes.admin.setup", { processStatus: "running" });
  app.use("/admin", adminAuthRoutes);
  app.use("/admin", adminRoutes);

  logger.info("routes.main.setup", { processStatus: "running" });
  app.use(mainRoutes);
}

function setupApiRoutes(app: Application): void {
  logger.info("routes.api.setup", { processStatus: "running" });
  app.use("/api", apiLimiter, apiRoutes);
  app.use("/upload", apiLimiter, uploadRoutes);
  app.post("/report-violation", cspViolationReporter);
}

function setupErrorHandling(app: Application): void {
  logger.info("routes.error_handler.setup", { processStatus: "running" });
  app.use(errorHandler);
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: "Not Found",
      message: "The requested page does not exist.",
      status: 404,
    });
  });
}

export function setupRoutes(app: Application): void {
  try {
    setupBaseRoutes(app);
    setupApiRoutes(app);
    setupErrorHandling(app);

    logger.info("routes.setup.completed", { processStatus: "completed" });
  } catch (error) {
    logger.error("routes.setup.failed", {
      processStatus: "failed",
      meta: { error: error instanceof Error ? error.message : "Unknown error" },
    });
    throw error;
  }
}
