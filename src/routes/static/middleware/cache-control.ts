/**
 * Cache Control Middleware
 *
 * Configures appropriate cache control headers for static assets
 * @module routes/static/middleware
 */

"use strict";

import { Request, Response, NextFunction } from "express";
import { assert } from "../../../utils/safety-utils.js";
import { getFileExtension } from "../utils/file-path-validation.js";

/**
 * Cache duration in seconds
 * @constant {Object}
 */
const CACHE_DURATION = {
  STATIC: 60 * 60 * 24 * 30, // 30 days
  IMAGES: 60 * 60 * 24 * 7, // 7 days
  SCRIPTS: 60 * 60 * 24, // 1 day
  STYLES: 60 * 60 * 24, // 1 day
};

/**
 * Determines appropriate cache duration based on file extension
 *
 * @param fileExtension - File extension including dot
 * @returns Appropriate cache duration in seconds
 */
function getCacheDuration(fileExtension: string): number {
  if (!fileExtension) {
    return CACHE_DURATION.STATIC;
  }

  const ext = fileExtension.toLowerCase();

  if (
    [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico"].includes(ext)
  ) {
    return CACHE_DURATION.IMAGES;
  }

  if ([".js", ".mjs"].includes(ext)) {
    return CACHE_DURATION.SCRIPTS;
  }

  if ([".css"].includes(ext)) {
    return CACHE_DURATION.STYLES;
  }

  return CACHE_DURATION.STATIC;
}

/**
 * Sets cache control headers based on file type and environment
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {void}
 */
export const setCacheHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Assert preconditions
  assert(Boolean(req), "Request object is required");
  assert(Boolean(res), "Response object is required");
  assert(Boolean(next), "Next function is required");

  // Get the file path from the request
  const filePath: string = req.path;

  // Never cache dynamic API/admin/upload routes
  if (
    filePath.startsWith("/api/") ||
    filePath === "/api" ||
    filePath.startsWith("/upload/") ||
    filePath === "/upload" ||
    filePath.startsWith("/admin/") ||
    filePath === "/admin"
  ) {
    res.setHeader("Cache-Control", "no-store");
    next();
    return;
  }

  // Set cache control header based on file type
  const fileExtension = getFileExtension(filePath);
  if (!fileExtension) {
    // Dynamic routes without extension should not be cached
    res.setHeader("Cache-Control", "no-store");
    next();
    return;
  }

  const maxAge = getCacheDuration(fileExtension);

  res.setHeader("Cache-Control", `public, max-age=${maxAge}`);

  next();
};
