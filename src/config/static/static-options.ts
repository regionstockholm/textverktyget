/**
 * Static Files Configuration Module
 * Configures static file serving options and MIME types for secure and optimized delivery
 * @module config/static
 */

import { Response } from "express";
import path from "path";
import { config } from "../app-config.js";

/**
 * Interface for static file serving options
 */
interface StaticOptions {
  etag: boolean;
  lastModified: boolean;
  maxAge: string | number;
  setHeaders: (res: Response, path: string) => void;
}

/**
 * MIME type mapping for common file extensions
 * Explicitly defines MIME types to prevent content-sniffing attacks
 */
const MIME_TYPES: Readonly<Record<string, string>> = {
  ".js": "application/javascript; charset=UTF-8",
  ".mjs": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".html": "text/html; charset=UTF-8",
  ".htm": "text/html; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".map": "application/json; charset=UTF-8",
  ".txt": "text/plain; charset=UTF-8",
  ".xml": "application/xml; charset=UTF-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
};

/**
 * Sets appropriate MIME type headers based on file extension
 * @param response - Express response object
 * @param filePath - Path to the file being served
 */
function setMimeTypeHeader(response: Response, filePath: string): void {
  if (!filePath) {
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[extension];

  if (mimeType) {
    response.setHeader("Content-Type", mimeType);
  }
}

/**
 * Gets appropriate cache control headers
 * @returns Appropriate cache control header value
 */
function getCacheControlHeader(): string {
  return config.serverSettings.cacheControl;
}

/**
 * Validates a static file path
 * @param filePath - Path to validate
 * @returns True if path is valid, false otherwise
 */
function isValidFilePath(filePath: string): boolean {
  return typeof filePath === "string" && filePath.length > 0;
}

/**
 * Generates configuration options for static file serving
 * @returns Express static middleware configuration
 *
 * Files are cached for 30 days with ETag and Last-Modified headers for conditional requests.
 */
const getStaticOptions = (): StaticOptions => ({
  etag: true, // Enable ETag for conditional requests and caching
  lastModified: true, // Enable Last-Modified header for conditional requests
  maxAge: "30d", // Cache for 30 days
  setHeaders: (res: Response, filePath: string) => {
    if (!isValidFilePath(filePath)) {
      return;
    }

    // Set cache control headers
    res.setHeader("Cache-Control", getCacheControlHeader());

    // Set secure MIME types to prevent content-sniffing attacks
    setMimeTypeHeader(res, filePath);
  },
});

export default getStaticOptions;
