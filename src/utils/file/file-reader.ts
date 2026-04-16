/**
 * File Reader Utility
 *
 * Provides safe file reading functionality with size limits and validation.
 *
 * @module utils/file/file-reader
 * @version 1.0.0
 */

"use strict";

import { promises as fs } from "fs";
import { assert } from "../safety-utils.js";
import { FileLimits } from "../../config/shared-config.js";

/**
 * Safely reads a file with size checking
 *
 * @param {string} filePath - Path to the file
 * @param {string} encoding - File encoding
 * @param {number} [maxSize=FileLimits.MAX_FILE_SIZE] - Maximum allowed file size
 * @returns {Promise<string>} File contents
 * @throws {Error} If file is too large or cannot be read
 */
export async function safeReadFile(
  filePath: string,
  encoding: BufferEncoding,
  maxSize: number = FileLimits.MAX_FILE_SIZE,
): Promise<string> {
  // Assert preconditions
  assert(typeof filePath === "string", "File path must be a string");
  assert(typeof encoding === "string", "Encoding must be a string");
  assert(typeof maxSize === "number", "Max size must be a number");
  assert(maxSize > 0, "Max size must be positive");

  try {
    // Check file size before reading
    const stats = await fs.stat(filePath);

    if (stats.size > maxSize) {
      throw new Error(
        `File too large: ${stats.size} bytes (max: ${maxSize} bytes)`,
      );
    }

    // Check return value
    const content = await fs.readFile(filePath, encoding);
    assert(typeof content === "string", "File content must be a string");

    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}
