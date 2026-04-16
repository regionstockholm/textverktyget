/**
 * Development Logger Middleware
 * Provides basic request logging for development environment
 * Logs timestamp, HTTP method, and requested URL
 * @module middleware/logger
 */

import { Request, Response, NextFunction } from "express";

const isLocalDev = process.env.LOCAL_DEV === "true";

/**
 * Simple request logger for development use
 * Outputs request details to console in ISO timestamp format
 *
 * @param {Request} req - Express request object
 * @param {Response} _res - Express response object (unused)
 * @param {NextFunction} next - Express next middleware function
 * @returns {void}
 */
export const developmentLogger = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (isLocalDev && req.path === "/health") {
    next();
    return;
  }
  // Log request details with ISO timestamp
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
};
