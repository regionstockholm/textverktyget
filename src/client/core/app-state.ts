/**
 * Application State Management
 * Manages the global state of the application
 */

// Add logging to track when this module is loaded
// App state module initialized

// Import safety utilities
import { assert } from "../safety/assertions.js";

/**
 * Global abort controller for cancelling ongoing requests
 * Only one request can be active at a time
 */
let currentAbortController: AbortController | null = null;

/**
 * Creates a new abort controller for a request
 * Cancels any existing request before creating a new one
 * @returns The new abort controller
 */
export function createAbortController(): AbortController {
  // Cancel any existing request
  if (currentAbortController) {
    console.log(
      "[AppState] Cancelling existing request before creating new one",
    );
    currentAbortController.abort("New request started");
  }

  // Create new abort controller
  currentAbortController = new AbortController();
  console.log("[AppState] New AbortController created");

  return currentAbortController;
}

/**
 * Gets the current abort controller
 * @returns The current abort controller or null if none exists
 */
export function getCurrentAbortController(): AbortController | null {
  return currentAbortController;
}

/**
 * Cancels the current request if one exists
 * @returns true if a request was cancelled, false otherwise
 */
export function cancelCurrentRequest(): boolean {
  if (currentAbortController) {
    console.log("[AppState] Cancelling current request (user initiated)");
    currentAbortController.abort("User cancelled request");
    currentAbortController = null;
    return true;
  }

  console.log("[AppState] No active request to cancel");
  return false;
}

/**
 * Clears the current abort controller
 * Called after a request completes successfully
 */
export function clearAbortController(): void {
  if (currentAbortController) {
    console.log(
      "[AppState] Clearing AbortController after successful completion",
    );
    currentAbortController = null;
  }
}

/**
 * Interface for file information
 */
export interface FileInfo {
  file: File;
  fileName: string;
  [key: string]: unknown; // Using unknown for better type safety
}

/**
 * Type for exportable functions
 */
export interface ExportableFunctions {
  [key: string]: Function;
}

/**
 * Result of global exports operation
 */
export interface GlobalExportsResult {
  success: boolean;
  exposedFunctions?: string[];
  errors?: string[];
}

/**
 * Process attached files and append their content to the initial text
 * @param initialText - The initial text content
 * @param clickCount - The current click count for logging
 * @param attachedFiles - Map of attached files
 * @param processFile - Function to process a file
 * @returns The combined text content
 */
export async function processAttachedFiles(
  initialText: string,
  clickCount: number,
  attachedFiles: Map<string, unknown>,
  processFile: (file: File) => Promise<string>,
): Promise<string> {
  console.log(`[AppState] ========== PROCESSING ATTACHED FILES ==========`);
  console.log(`[AppState] Initial text length: ${initialText.length}`);
  console.log(`[AppState] Click count: ${clickCount}`);

  assert(typeof initialText === "string", "Initial text must be a string");
  assert(typeof clickCount === "number", "Click count must be a number");

  const fileCount = attachedFiles.size;
  console.log(`[AppState] Number of attached files: ${fileCount}`);

  // If there are attached files, skip the textarea content
  let allText = fileCount > 0 ? "" : initialText;
  console.log(`[AppState] Files attached: ${fileCount > 0 ? "YES" : "NO"}`);
  console.log(
    `[AppState] Will use textarea content: ${fileCount > 0 ? "NO (files present)" : "YES (no files)"}`,
  );

  if (fileCount === 0) {
    console.log(
      `[AppState] No files to process, returning initial text (length: ${initialText.length})`,
    );
    return allText;
  }

  console.log(`[AppState] Processing ${fileCount} file(s)...`);

  for (const [fileId, fileInfo] of attachedFiles.entries()) {
    try {
      console.log(`[AppState] Processing file ID: ${fileId}`);

      assert(
        !!fileInfo && !!(fileInfo as FileInfo).file,
        `Invalid file info for ID: ${fileId}`,
      );

      // Destructure fileInfo to avoid deep property access (Rule 9)
      const { file, fileName } = fileInfo as FileInfo;

      console.log(
        `[AppState] File details - Name: ${fileName}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type}`,
      );

      const startTime = performance.now();
      console.log(`[AppState] Calling processFile for: ${fileName}`);

      const fileContent = await processFile(file);

      const endTime = performance.now();

      assert(typeof fileContent === "string", "File content must be a string");

      const processingTimeSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(
        `[AppState] File processed in ${processingTimeSeconds} seconds`,
      );
      console.log(
        `[AppState] Extracted ${fileContent.length} characters from ${fileName}`,
      );
      console.log(
        `[AppState] First 100 characters: ${fileContent.substring(0, 100)}...`,
      );

      // If it's the first file and we're ignoring textarea content, don't add newlines
      if (allText === "") {
        console.log(`[AppState] First file, setting as allText`);
        allText = fileContent;
      } else {
        console.log(`[AppState] Appending to existing text`);
        allText += "\n\n" + fileContent;
      }

      console.log(`[AppState] Current total text length: ${allText.length}`);
    } catch (error) {
      const typedFileInfo = fileInfo as FileInfo | undefined;
      console.error(
        `[AppState] Error processing file ${typedFileInfo?.fileName || fileId}:`,
        error,
      );

      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error(`[AppState] Error message: ${errorMessage}`);
        console.error(`[AppState] Error stack:`, error.stack);
      }

      alert(
        `Det gick inte att läsa filen ${
          typedFileInfo?.fileName || fileId
        }. ${errorMessage}`,
      );
    }
  }

  console.log(`[AppState] ========== FILE PROCESSING COMPLETE ==========`);
  console.log(`[AppState] Final combined text length: ${allText.length}`);
  console.log(`[AppState] Returning text to summarization`);

  return allText;
}
