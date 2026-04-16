/**
 * File Path Validation Utility
 *
 * Provides functions for validating file paths
 * @module routes/static/utils
 */

"use strict";

import { assert } from "../../../utils/safety-utils.js";
import path from "path";

/**
 * Validates a static file path
 *
 * @param filePath - Path to validate
 * @returns True if path is valid, false otherwise
 */
export function isValidFilePath(filePath: string): boolean {
  if (typeof filePath !== "string" || filePath.length === 0) {
    return false;
  }

  // Check for path traversal attempts
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes("..")) {
    return false;
  }

  return true;
}

/**
 * Gets file extension from path
 *
 * @param filePath - Path to extract extension from
 * @returns File extension including dot, or empty string if none
 */
export function getFileExtension(filePath: string): string {
  assert(isValidFilePath(filePath), "Invalid file path");
  return path.extname(filePath).toLowerCase();
}
