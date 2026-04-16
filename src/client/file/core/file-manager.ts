/**
 * File Manager Module
 * Handles core file management operations
 */

import { FileValidator } from "../../../utils/file/file-validator.js";
import { FileInfo } from "../models/file-info.js";
import { FileUploadStatus } from "../models/upload-status.js";
import { generateUniqueId, processFile } from "./file-processor.js";
import { assert } from "../../safety/assertions.js";
import { ElementManager } from "../../ui/utils/element-manager.js";

/**
 * FileManager class
 * Handles file management operations including storing, removing, and processing uploaded files
 */
export class FileManager {
  private attachedFiles: Map<string, FileInfo>;
  private elementManager: ElementManager;
  private uploadStatus: FileUploadStatus;

  /**
   * Initialize the FileManager
   * @param attachedFiles - Map to store uploaded files
   * @param elementManager - Instance of ElementManager for UI updates
   */
  constructor(
    attachedFiles: Map<string, FileInfo>,
    elementManager: ElementManager,
  ) {
    assert(attachedFiles instanceof Map, "attachedFiles must be a Map");
    assert(
      elementManager && typeof elementManager === "object",
      "elementManager must be a valid object",
    );
    assert(
      typeof elementManager.createFileListItem === "function",
      "elementManager must have createFileListItem method",
    );
    assert(
      typeof elementManager.updateFileArea === "function",
      "elementManager must have updateFileArea method",
    );
    assert(
      typeof elementManager.showError === "function",
      "elementManager must have showError method",
    );
    assert(
      typeof elementManager.updateFileUploadContainer === "function",
      "elementManager must have updateFileUploadContainer method",
    );

    this.attachedFiles = attachedFiles;
    this.elementManager = elementManager;
    this.uploadStatus = {
      inProgress: false,
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
    };

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for file management
   */
  private setupEventListeners(): void {
    document.addEventListener(
      "remove-all-files",
      this.clearAllFiles.bind(this),
    );
    document.addEventListener("files-dropped", (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.files) {
        this.handleFiles(customEvent.detail.files);
      }
    });
  }

  /**
   * Stores a new file in the attachedFiles Map and creates UI representation
   * @param file - The file object to store
   * @returns true if the file was stored successfully, false otherwise
   */
  storeFile(file: File): boolean {
    try {
      assert(file instanceof File, "file must be a File object");

      const fileId = generateUniqueId();
      this.attachedFiles.set(fileId, { file, fileName: file.name });

      const listItem = this.elementManager.createFileListItem(
        file.name,
        fileId,
      );
      this.elementManager.elements.fileList.appendChild(listItem);
      this.elementManager.updateFileArea();

      // Add event listener for file removal
      const removeButton = listItem.querySelector(
        '[data-action="remove-file"]',
      );
      if (removeButton) {
        removeButton.addEventListener("click", (e: Event) => {
          const target = e.currentTarget as HTMLElement;
          const fileId = target.dataset.id;
          if (fileId) {
            this.removeFile(fileId);
          }
        });
      }

      return true;
    } catch (error) {
      this.handleError("Failed to store file", error);
      return false;
    }
  }

  /**
   * Removes a file from storage and updates UI
   * @param fileId - Unique identifier of the file to remove
   */
  removeFile(fileId: string): void {
    try {
      assert(typeof fileId === "string", "fileId must be a string");

      this.attachedFiles.delete(fileId);
      const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);

      if (fileItem) {
        fileItem.remove();
      }

      // Update UI based on file presence
      this.updateUIAfterFileRemoval();
    } catch (error) {
      this.handleError("Failed to remove file", error);
    }
  }

  /**
   * Update UI elements after file removal
   */
  private updateUIAfterFileRemoval(): void {
    try {
      const hasNoFiles =
        this.elementManager.elements.fileList.children.length === 0;

      if (hasNoFiles) {
        this.elementManager.elements.fileArea.classList.remove("has-files");
        this.elementManager.updateFileUploadContainer(false);
      }
    } catch (error) {
      this.handleError("Error updating UI after file removal", error);
    }
  }

  /**
   * Removes all files from storage and resets UI
   */
  clearAllFiles(): void {
    try {
      this.attachedFiles.clear();
      this.elementManager.elements.fileList.innerHTML = "";
      this.elementManager.elements.fileArea.classList.remove("has-files");
      this.elementManager.updateFileUploadContainer(false);

      // Reset upload status
      this.resetUploadStatus();
    } catch (error) {
      this.handleError("Failed to clear all files", error);
    }
  }

  /**
   * Reset the upload status tracking
   */
  private resetUploadStatus(): void {
    this.uploadStatus = {
      inProgress: false,
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
    };
  }

  /**
   * Processes an array of files, validating and storing them
   * @param files - FileList or File[] object containing files to process
   */
  handleFiles(files: FileList | File[]): void {
    try {
      // Prevent handling files if upload is already in progress
      if (this.uploadStatus.inProgress) {
        // Upload already in progress, silently return instead of showing error
        console.log("Upload already in progress, ignoring new files");
        return;
      }

      assert(
        files instanceof FileList || Array.isArray(files),
        "files must be a FileList or Array",
      );

      // Explicit limit check
      const MAX_FILES = 10;
      assert(files.length <= MAX_FILES * 2, "Too many files to process");

      const fileArray = Array.from(files);

      // Use setTimeout to ensure UI updates are complete before processing
      const PROCESSING_DELAY = 100;
      setTimeout(() => {
        this.processFiles(fileArray);
      }, PROCESSING_DELAY);
    } catch (error) {
      this.handleError("Error handling files", error);
    }
  }

  /**
   * Process files for validation and storage
   * @param fileArray - Array of files to process
   */
  private processFiles(fileArray: File[]): void {
    try {
      assert(Array.isArray(fileArray), "fileArray must be an Array");

      // Reset upload status for new batch
      this.resetUploadStatus();

      // Start upload process
      this.uploadStatus.inProgress = true;

      // Check remaining file slots
      const remainingSlots = FileValidator.getRemainingSlots(
        this.attachedFiles.size,
      );

      if (remainingSlots <= 0) {
        this.showMaxFilesError();
        this.uploadStatus.inProgress = false;
        return;
      }

      // Set total files to process
      this.uploadStatus.totalFiles = Math.min(fileArray.length, remainingSlots);

      // Filter valid files
      const validFiles = this.filterValidFiles(fileArray);

      // Process the valid files
      this.processValidFiles(validFiles, fileArray.length, remainingSlots);
    } catch (error) {
      this.handleError("Error processing files", error);
      this.uploadStatus.inProgress = false;
    }
  }

  /**
   * Process a single file for text extraction
   * @param file - The file to process
   * @returns Promise resolving to the extracted text
   */
  async processFileForText(file: File): Promise<string> {
    try {
      assert(file instanceof File, "file must be a File object");

      // Use the comprehensive validation method
      const validationResult = FileValidator.validateFile(
        file,
        this.attachedFiles,
      );

      if (!validationResult.isValid) {
        throw new Error(validationResult.errors.join(", "));
      }

      // Process the file
      return await processFile(file);
    } catch (error) {
      this.handleError("Error processing file for text", error);
      return "";
    }
  }

  /**
   * Show error message when maximum files limit is reached
   */
  private showMaxFilesError(): void {
    const MAX_FILES = 10;
    this.elementManager.showError(
      `Du kan inte lägga till fler än ${MAX_FILES} dokument.`,
    );
  }

  /**
   * Process valid files after filtering
   * @param validFiles - Array of valid files
   * @param totalFiles - Total number of files attempted
   * @param remainingSlots - Number of remaining file slots
   */
  private processValidFiles(
    validFiles: File[],
    totalFiles: number,
    remainingSlots: number,
  ): void {
    try {
      assert(Array.isArray(validFiles), "validFiles must be an Array");
      assert(typeof totalFiles === "number", "totalFiles must be a number");
      assert(
        typeof remainingSlots === "number",
        "remainingSlots must be a number",
      );

      // Limit to remaining slots
      const filesToAdd = validFiles.slice(0, remainingSlots);

      // Update container visibility
      this.updateContainerVisibility(filesToAdd.length);

      // Process files in smaller batches for better performance
      this.processBatchedFiles(filesToAdd, totalFiles, remainingSlots);
    } catch (error) {
      this.handleError("Error processing valid files", error);
      this.uploadStatus.inProgress = false;
    }
  }

  /**
   * Process files in batches to prevent UI freezing
   * @param filesToAdd - Array of files to process
   * @param totalFiles - Total number of files attempted
   * @param remainingSlots - Number of remaining file slots
   */
  private processBatchedFiles(
    filesToAdd: File[],
    totalFiles: number,
    remainingSlots: number,
  ): void {
    try {
      assert(Array.isArray(filesToAdd), "filesToAdd must be an Array");

      const batchSize = 3;
      let currentIndex = 0;
      let filesAdded = 0;

      const processBatch = () => {
        // Stop if we've processed all files
        if (currentIndex >= filesToAdd.length) {
          // Show final status message
          this.finalizeUploadProcess(filesAdded, totalFiles, remainingSlots);
          return;
        }

        // Process current batch
        const endIndex = Math.min(currentIndex + batchSize, filesToAdd.length);
        let batchSuccess = 0;

        for (let i = currentIndex; i < endIndex; i++) {
          const file = filesToAdd[i];
          if (file && this.storeFile(file)) {
            batchSuccess++;
            filesAdded++;
          }
          this.uploadStatus.processedFiles++;
        }

        // Update for next batch
        currentIndex = endIndex;

        // Schedule next batch with small delay
        const BATCH_DELAY = 100;
        setTimeout(processBatch, BATCH_DELAY);
      };

      // Start batch processing
      processBatch();
    } catch (error) {
      this.handleError("Error processing files in batches", error);
      this.uploadStatus.inProgress = false;
    }
  }

  /**
   * Finalize the upload process and show summary message
   * @param filesAdded - Number of files successfully added
   * @param totalFiles - Total number of files attempted
   * @param remainingSlots - Number of remaining file slots
   */
  private finalizeUploadProcess(
    filesAdded: number,
    totalFiles: number,
    remainingSlots: number,
  ): void {
    try {
      // Mark upload as complete
      this.uploadStatus.inProgress = false;

      // Show warning if some files were skipped due to limit
      if (totalFiles > remainingSlots) {
        this.showPartialUploadWarning(filesAdded);
      } else if (filesAdded > 0 && filesAdded < totalFiles) {
        // Some files failed but not due to limit
        this.elementManager.showError(
          `${filesAdded} av ${totalFiles} filer lades till. De övriga filerna kunde inte laddas upp.`,
        );
      } else if (filesAdded > 0) {
        // All files uploaded successfully
        console.log(`Successfully added ${filesAdded} files`);
      }

      // Dispatch event that upload is complete
      document.dispatchEvent(
        new CustomEvent("files-upload-complete", {
          detail: { filesAdded, totalFiles },
        }),
      );
    } catch (error) {
      this.handleError("Error finalizing upload process", error);
    }
  }

  /**
   * Filter files based on validation rules
   * @param fileArray - Array of files to filter
   * @returns Array of valid files
   */
  private filterValidFiles(fileArray: File[]): File[] {
    assert(Array.isArray(fileArray), "fileArray must be an Array");

    const validFiles: File[] = [];
    this.uploadStatus.errors = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      // Skip if file is undefined
      if (!file) {
        continue;
      }

      // Use the comprehensive validator to check all validation rules at once
      const validationResult = FileValidator.validateFile(
        file,
        this.attachedFiles,
      );

      if (!validationResult.isValid) {
        // Store error for later reporting
        if (validationResult.errors.length > 0) {
          const errorMessage =
            validationResult.errors[0] || `Invalid file: ${file.name}`;
          this.uploadStatus.errors.push(errorMessage);

          // Show the first error message to the user
          if (this.uploadStatus.errors.length === 1) {
            this.elementManager.showError(errorMessage);
          }
        }
        continue;
      }

      validFiles.push(file);
    }

    return validFiles;
  }

  /**
   * Update container visibility based on file presence
   * @param validFileCount - Number of valid files to add
   */
  private updateContainerVisibility(validFileCount: number): void {
    try {
      assert(
        typeof validFileCount === "number",
        "validFileCount must be a number",
      );

      const hasFiles = validFileCount > 0 || this.attachedFiles.size > 0;
      this.elementManager.updateFileUploadContainer(hasFiles);
    } catch (error) {
      this.handleError("Error updating container visibility", error);
    }
  }

  /**
   * Show warning when some files were skipped due to limit
   * @param filesAdded - Number of files that were added
   */
  private showPartialUploadWarning(filesAdded: number): void {
    try {
      assert(typeof filesAdded === "number", "filesAdded must be a number");

      const MAX_FILES = 10;
      this.elementManager.showError(
        `Endast ${filesAdded} av filerna lades till. Maximal gräns på ${MAX_FILES} dokument har uppnåtts.`,
      );
    } catch (error) {
      this.handleError("Error showing partial upload warning", error);
    }
  }

  /**
   * Get the current upload status
   * @returns Current file upload status
   */
  public getUploadStatus(): FileUploadStatus {
    return { ...this.uploadStatus };
  }

  /**
   * Handle errors in file operations
   * @param message - Error message
   * @param error - The error object
   */
  private handleError(message: string, error: unknown): void {
    console.error(message, error);

    if (error instanceof Error) {
      this.elementManager.showError(`${message}: ${error.message}`);
    } else {
      this.elementManager.showError(message);
    }
  }
}
