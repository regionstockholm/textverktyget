/**
 * File Storage Module
 * Handles local storage of file information
 */

import { assert } from "../../safety/assertions.js";
import { FileInfo } from "../models/file-info.js";

/**
 * Maximum number of file references to store in local storage
 */
const LOCAL_STORAGE_MAX_FILES = 10;

/**
 * Key used for storing file references in local storage
 */
const FILE_STORAGE_KEY = "textverktyg_recent_files";

/**
 * FileStorage class
 * Handles storing file references in local storage
 * Enables limited persistence between sessions
 */
export class FileStorage {
  /**
   * Save file references to local storage
   * Only stores minimal info needed to restore files between sessions
   * @param attachedFiles - Map of files to store references for
   */
  static saveFileReferences(attachedFiles: Map<string, FileInfo>): void {
    try {
      assert(attachedFiles instanceof Map, "attachedFiles must be a Map");

      // Don't save if there are no files
      if (attachedFiles.size === 0) {
        localStorage.removeItem(FILE_STORAGE_KEY);
        return;
      }

      // Convert the map to an array of minimal file information
      const fileInfoArray = Array.from(attachedFiles).map(([id, fileInfo]) => ({
        id,
        name: fileInfo.fileName,
        timestamp: Date.now(),
      }));

      // Limit the number of stored references
      const limitedArray = fileInfoArray.slice(0, LOCAL_STORAGE_MAX_FILES);

      localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(limitedArray));
    } catch (error) {
      console.error("Error saving file references:", error);
      // Silent failure as this is not critical functionality
    }
  }

  /**
   * Clear all stored file references from local storage
   */
  static clearFileReferences(): void {
    try {
      localStorage.removeItem(FILE_STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing file references:", error);
      // Silent failure as this is not critical functionality
    }
  }

  /**
   * Check if file references exist in local storage
   * @returns True if file references exist, false otherwise
   */
  static hasStoredFileReferences(): boolean {
    try {
      const storedData = localStorage.getItem(FILE_STORAGE_KEY);
      return storedData !== null && storedData !== "[]";
    } catch (error) {
      console.error("Error checking for stored file references:", error);
      return false;
    }
  }
}
