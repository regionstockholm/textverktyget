/**
 * Request Logger Middleware
 * Provides basic request logging
 * Logs timestamp, HTTP method, and requested URL
 * @module middleware/logger
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Simple request logger
 * Outputs request details to console in ISO timestamp format
 *
 * @param {Request} req - Express request object
 * @param {Response} _res - Express response object (unused)
 * @param {NextFunction} next - Express next middleware function
 * @returns {void}
 */
export const requestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.path === "/health") {
    next();
    return;
  }
  // Log request details with ISO timestamp
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
};
