/**
 * Security Headers Middleware
 *
 * Sets security headers for static files to protect against common web vulnerabilities
 * @module routes/static/middleware
 */

"use strict";

import { Request, Response, NextFunction } from "express";
import { config } from "../../../config/app-config.js";
import { assert } from "../../../utils/safety-utils.js";

/**
 * Security headers applied to all environments
 * @constant {Object}
 */
const BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-Download-Options": "noopen",
};

/**
 * Additional security headers for production environments
 * @constant {Object}
 */
const PRODUCTION_SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Source-Map": "none",
};

/**
 * Sets security headers for static files
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {void}
 */
export const setSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Assert preconditions
  assert(Boolean(req), "Request object is required");
  assert(Boolean(res), "Response object is required");
  assert(Boolean(next), "Next function is required");

  // Remove potentially sensitive headers
  res.removeHeader("X-Powered-By");

  // Set basic security headers for all environments
  Object.entries(BASE_SECURITY_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  // Add additional headers for production
  if (config.isProduction) {
    Object.entries(PRODUCTION_SECURITY_HEADERS).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
  }

  next();
};
