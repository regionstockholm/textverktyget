/**
 * Format Detector Module
 * Handles document format detection and validation
 */

import { assert } from "../../utils/safety-utils.js";
import {
  getFileExtension,
  isSupportedExtension,
} from "../../utils/file/file-type-policy.js";

/**
 * Validates if a file type is supported for text extraction
 * @param filename - The filename to check
 * @returns True if the file type is supported
 * @throws Error if filename is invalid
 */
export function isFileTypeSupported(filename: string): boolean {
  assert(typeof filename === "string", "Filename must be a string");
  assert(filename.includes("."), "Filename must have an extension");

  return isSupportedExtension(getFileExtension(filename));
}
