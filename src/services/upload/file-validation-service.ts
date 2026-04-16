/**
 * File Validation Service Module
 * Handles server-side file validation
 */

import { UPLOAD_CONFIG } from "./file-storage-service.js";
import { assert } from "../../utils/safety-utils.js";

/**
 * Interface for file validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates file type
 */
export function validateFileType(mimetype: string): boolean {
  assert(typeof mimetype === "string", "Mimetype must be a string");
  return UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(mimetype);
}

/**
 * Validates file size
 */
export function validateFileSize(size: number): boolean {
  assert(typeof size === "number", "Size must be a number");
  return size > 0 && size <= UPLOAD_CONFIG.MAX_FILE_SIZE;
}

/**
 * Validates a file based on its metadata
 */
export function validateFile(file: Express.Multer.File): FileValidationResult {
  const errors: string[] = [];

  // Validate file presence
  if (!file) {
    return { isValid: false, errors: ["No file provided"] };
  }

  // Validate file type
  if (!validateFileType(file.mimetype)) {
    errors.push("File type not allowed");
  }

  // Validate file size
  if (!validateFileSize(file.size)) {
    errors.push(
      `File size must be between 1 byte and ${UPLOAD_CONFIG.MAX_FILE_SIZE} bytes`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
