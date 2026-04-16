/**
 * File Validation Module
 * Provides comprehensive validation utilities for file uploads
 */

import { assert } from "../safety-utils.js";
import { FileLimits } from "../../config/shared-config.js";
import {
  FileInfo,
  FileValidationResult,
} from "../../client/file/models/file-info.js";

/**
 * Supported file formats and their MIME types
 * Single source of truth for supported formats across the application
 */
export const SUPPORTED_FORMATS: Record<string, string> = {
  // Word documents
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Excel files
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // PowerPoint files
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // PDF files
  pdf: "application/pdf",
  // Text files
  txt: "text/plain",
  rtf: "application/rtf",
};

/**
 * FileValidator class
 * Provides static methods for robust file validation including:
 * - File type validation based on extension and MIME type
 * - File size validation against configured limits
 * - Duplicate detection to prevent redundant uploads
 * - Upload limit enforcement for system stability
 */
export class FileValidator {
  /**
   * Validates if a file's type is supported based on extension and MIME type
   * @param file - The file object to validate
   * @returns True if the file type is supported, false otherwise
   */
  static isFileTypeSupported(file: File): boolean {
    assert(file && file instanceof File, "Invalid file object");
    assert(typeof file.name === "string", "File name must be a string");
    assert(typeof file.type === "string", "File type must be a string");

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type.toLowerCase();

    // Check if extension exists in supported formats
    if (!SUPPORTED_FORMATS[extension]) {
      return false;
    }

    const expectedMimeType = SUPPORTED_FORMATS[extension];
    return mimeType.includes(expectedMimeType.toLowerCase());
  }

  /**
   * Validates if a file's size is within acceptable limits
   * @param file - The file object to validate
   * @returns True if the file size is valid, false otherwise
   */
  static isFileSizeValid(file: File): boolean {
    assert(file && file instanceof File, "Invalid file object");
    assert(typeof file.size === "number", "File size must be a number");

    return file.size > 0 && file.size <= FileLimits.MAX_FILE_SIZE;
  }

  /**
   * Checks if a file has already been uploaded
   * @param file - The file to check
   * @param attachedFiles - Map of currently attached files
   * @returns True if the file is already uploaded, false otherwise
   */
  static isFileAlreadyUploaded(
    file: File,
    attachedFiles: Map<string, FileInfo>,
  ): boolean {
    assert(file && file instanceof File, "Invalid file object");
    assert(attachedFiles instanceof Map, "Attached files must be a Map");

    for (const [, fileInfo] of attachedFiles) {
      if (fileInfo.fileName === file.name) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets a comma-separated list of supported file extensions
   * Used for displaying allowed formats to users and configuring file inputs
   * @returns Comma-separated list of supported file extensions with dots
   */
  static getSupportedExtensions(): string {
    assert(
      SUPPORTED_FORMATS !== undefined,
      "Supported formats must be defined",
    );
    assert(
      typeof SUPPORTED_FORMATS === "object",
      "Supported formats must be an object",
    );

    return Object.keys(SUPPORTED_FORMATS)
      .map((ext) => `.${ext}`)
      .join(", ");
  }

  /**
   * Gets an array of supported file extensions
   * @returns Array of supported file extensions with dots
   */
  static getSupportedExtensionsArray(): string[] {
    assert(
      SUPPORTED_FORMATS !== undefined,
      "Supported formats must be defined",
    );
    assert(
      typeof SUPPORTED_FORMATS === "object",
      "Supported formats must be an object",
    );

    return Object.keys(SUPPORTED_FORMATS).map((ext) => `.${ext}`);
  }

  /**
   * Gets the remaining number of file slots available
   * @param currentFileCount - Current number of attached files
   * @returns Number of remaining file slots
   */
  static getRemainingSlots(currentFileCount: number): number {
    assert(typeof currentFileCount === "number", "File count must be a number");
    assert(currentFileCount >= 0, "File count cannot be negative");

    return Math.max(0, FileLimits.MAX_FILES - currentFileCount);
  }

  /**
   * Performs comprehensive validation on a file
   * Combines type, size, and other validations in a single call
   * @param file - The file to validate
   * @param attachedFiles - Map of currently attached files
   * @returns Object with validation results and error messages
   */
  static validateFile(
    file: File,
    attachedFiles: Map<string, FileInfo>,
  ): FileValidationResult {
    assert(file && file instanceof File, "Invalid file object");
    assert(attachedFiles instanceof Map, "Attached files must be a Map");

    const errors: string[] = [];

    // Check file type
    if (!this.isFileTypeSupported(file)) {
      const supportedExtensions = this.getSupportedExtensions();
      errors.push(
        `Filen "${file.name}" stöds inte. Tillåtna format: ${supportedExtensions}`,
      );
    }

    // Check file size
    if (!this.isFileSizeValid(file)) {
      const maxSizeMB = FileLimits.MAX_FILE_SIZE / (1024 * 1024);
      errors.push(
        `Filen "${file.name}" är för stor. Maximal filstorlek är ${maxSizeMB}MB.`,
      );
    }

    // Check for duplicates
    if (this.isFileAlreadyUploaded(file, attachedFiles)) {
      errors.push(`Filen "${file.name}" är redan tillagd.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
