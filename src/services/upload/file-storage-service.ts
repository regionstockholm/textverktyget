/**
 * File Storage Service Module
 * Handles file storage operations on the server
 */

import fs from "fs";
import path from "path";
import { assert } from "../../utils/safety-utils.js";

/**
 * Configuration for file storage
 */
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB hard cap
  ALLOWED_MIME_TYPES: [
    "text/plain",
    "text/markdown",
    "text/html",
    "application/json",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  UPLOAD_DIR: path.join(process.cwd(), "uploads"),
};

/**
 * Ensures upload directory exists
 */
export async function ensureUploadDir(): Promise<void> {
  try {
    await fs.promises.mkdir(UPLOAD_CONFIG.UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating upload directory:", error);
    throw error;
  }
}

/**
 * Generates a secure filename for uploaded files
 */
export function generateSecureFilename(originalname: string): string {
  assert(
    typeof originalname === "string",
    "Original filename must be a string",
  );

  const ext = path.extname(originalname).toLowerCase();
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);

  return `${timestamp}-${randomStr}${ext}`;
}

/**
 * Gets the full path for a file in the upload directory
 */
export function getUploadPath(filename: string): string {
  assert(typeof filename === "string", "Filename must be a string");
  return path.join(UPLOAD_CONFIG.UPLOAD_DIR, path.basename(filename));
}

/**
 * Checks if a file exists in the upload directory
 */
export async function fileExists(filename: string): Promise<boolean> {
  try {
    await fs.promises.access(getUploadPath(filename), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a file from the upload directory
 */
export async function deleteFile(filename: string): Promise<void> {
  const filePath = getUploadPath(filename);
  await fs.promises.unlink(filePath);
}
