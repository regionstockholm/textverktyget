/**
 * File Cleanup Service Module
 * Handles periodic cleanup of temporary upload files
 */

import fs from "fs";
import path from "path";
import { UPLOAD_CONFIG } from "./file-storage-service.js";
import { assert } from "../../utils/safety-utils.js";

/**
 * Configuration for file cleanup
 */
const CLEANUP_CONFIG = {
  // Run cleanup every 15 minutes
  CLEANUP_INTERVAL_MS: 15 * 60 * 1000,
  // Remove files older than 30 minutes
  FILE_MAX_AGE_MS: 30 * 60 * 1000,
  // Maximum number of files to process in one cleanup cycle
  MAX_FILES_PER_CYCLE: 100,
};

let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Checks if a file should be deleted based on its age
 * @param filePath - Path to the file
 * @param maxAgeMs - Maximum age in milliseconds
 * @returns True if file should be deleted
 */
async function shouldDeleteFile(
  filePath: string,
  maxAgeMs: number,
): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    const fileAge = Date.now() - stats.mtimeMs;
    return fileAge > maxAgeMs;
  } catch (error) {
    // If we can't stat the file, it might already be deleted
    console.error(`[Cleanup] Error checking file ${filePath}:`, error);
    return false;
  }
}

/**
 * Deletes a single file with error handling
 * @param filePath - Path to the file to delete
 * @returns True if deletion was successful
 */
async function deleteFileSafe(filePath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(filePath);
    console.log(`[Cleanup] Deleted old file: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    // File might already be deleted or in use
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[Cleanup] Failed to delete ${filePath}:`, error);
    }
    return false;
  }
}

/**
 * Cleans up old files from the upload directory
 * Removes files older than the configured maximum age
 */
export async function cleanupOldFiles(): Promise<void> {
  try {
    // Check if upload directory exists
    try {
      await fs.promises.access(UPLOAD_CONFIG.UPLOAD_DIR);
    } catch {
      // Directory doesn't exist, nothing to clean
      console.log(
        "[Cleanup] Upload directory does not exist, skipping cleanup",
      );
      return;
    }

    const files = await fs.promises.readdir(UPLOAD_CONFIG.UPLOAD_DIR);

    if (files.length === 0) {
      console.log("[Cleanup] No files to clean up");
      return;
    }

    console.log(`[Cleanup] Checking ${files.length} files for cleanup`);

    let deletedCount = 0;
    let checkedCount = 0;

    // Limit number of files processed per cycle for safety
    const filesToCheck = files.slice(0, CLEANUP_CONFIG.MAX_FILES_PER_CYCLE);

    for (const file of filesToCheck) {
      checkedCount++;
      const filePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR, file);

      // Skip if not a file
      try {
        const stats = await fs.promises.stat(filePath);
        if (!stats.isFile()) {
          continue;
        }
      } catch {
        continue;
      }

      // Check if file is old enough to delete
      const shouldDelete = await shouldDeleteFile(
        filePath,
        CLEANUP_CONFIG.FILE_MAX_AGE_MS,
      );

      if (shouldDelete) {
        const deleted = await deleteFileSafe(filePath);
        if (deleted) {
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      console.log(
        `[Cleanup] Cleanup complete: deleted ${deletedCount} old file(s) out of ${checkedCount} checked`,
      );
    } else {
      console.log(
        `[Cleanup] No old files found (checked ${checkedCount} files)`,
      );
    }
  } catch (error) {
    console.error("[Cleanup] Error during cleanup:", error);
  }
}

/**
 * Starts the periodic cleanup service
 * Runs cleanup at configured intervals
 */
export function startCleanupService(): void {
  assert(cleanupIntervalId === null, "Cleanup service is already running");

  console.log(
    `[Cleanup] Starting file cleanup service (interval: ${
      CLEANUP_CONFIG.CLEANUP_INTERVAL_MS / 1000 / 60
    } minutes, max age: ${CLEANUP_CONFIG.FILE_MAX_AGE_MS / 1000 / 60} minutes)`,
  );

  // Run cleanup immediately on startup
  cleanupOldFiles().catch((error) => {
    console.error("[Cleanup] Initial cleanup failed:", error);
  });

  // Schedule periodic cleanup
  cleanupIntervalId = setInterval(() => {
    cleanupOldFiles().catch((error) => {
      console.error("[Cleanup] Periodic cleanup failed:", error);
    });
  }, CLEANUP_CONFIG.CLEANUP_INTERVAL_MS);

  console.log("[Cleanup] Cleanup service started successfully");
}

/**
 * Stops the periodic cleanup service
 * Should be called during graceful shutdown
 */
export function stopCleanupService(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log("[Cleanup] Cleanup service stopped");
  }
}

/**
 * Gets the current cleanup configuration
 * Useful for testing and monitoring
 */
export function getCleanupConfig() {
  return {
    ...CLEANUP_CONFIG,
    isRunning: cleanupIntervalId !== null,
  };
}
