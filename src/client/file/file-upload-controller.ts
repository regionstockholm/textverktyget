/**
 * File Upload Controller Module
 * Main controller for file upload functionality
 */

import { FileValidator } from "../../utils/file/file-validator.js";
import type { FileInfo } from "./models/file-info.js";
import { FileUploadUI } from "./ui/upload-ui.js";
import type { FileUploadEvents } from "./ui/upload-ui.js";
import { FileManager } from "./core/file-manager.js";
import { ElementManager } from "./ui/element-manager.js";
import { fileLimits } from "../../config/shared-config.js";

/**
 * Collection of attached files
 */
export const attachedFiles: Map<string, FileInfo> = new Map();

/**
 * FileUploadController class
 * Main controller for file upload functionality, coordinating between UI, drag-drop,
 * and file management operations.
 */
class FileUploadController {
  private elementManager: ElementManager;
  private fileUploadUI: FileUploadUI;
  private fileManager: FileManager;

  /**
   * Initialize the FileUploadController and its dependent components
   */
  constructor() {
    console.log("Initializing FileUploadController...");
    // Initialize elements
    const elements = FileUploadUI.initializeElements();
    console.log("FileUpload elements initialized:", elements);

    // Initialize element manager
    this.elementManager = new ElementManager(elements);

    // Define upload event handlers
    const uploadEvents: FileUploadEvents = {
      onUploadStart: this.handleUploadStart.bind(this),
      onUploadComplete: this.handleUploadComplete.bind(this),
    };

    // Initialize UI components
    this.fileUploadUI = new FileUploadUI(
      elements,
      this.elementManager,
      attachedFiles,
      uploadEvents,
    );

    // Initialize core components
    this.fileManager = new FileManager(attachedFiles, this.elementManager);

    // Set accepted file types
    const acceptedTypes = FileValidator.getSupportedExtensionsArray();
    this.fileUploadUI.updateAcceptedFileTypes(acceptedTypes);
    console.log("Accepted file types updated:", acceptedTypes);

    // Set up file input change event
    const fileInput = this.fileUploadUI.getFileInput();
    fileInput.addEventListener("change", this.handleFileInputChange.bind(this));
    console.log("File input change event listener set up");

    // Set up upload completion listener for custom event
    document.addEventListener(
      "files-upload-complete",
      this.handleUploadCompleteEvent.bind(this),
    );
    console.log("Upload completion event listener set up");
  }

  /**
   * Handle file input change event
   */
  private handleFileInputChange(e: Event): void {
    console.log("File input change event triggered");

    const target = e.target as HTMLInputElement;
    const { files } = target;

    if (files && files.length > 0) {
      console.log(`${files.length} files selected for upload`);
      // Notify that upload has started
      this.handleUploadStart();

      // Process the files
      this.fileManager.handleFiles(files);

      // Reset file input to allow selecting the same file again
      target.value = "";
    } else {
      console.log("No files selected in file input");
    }
  }

  /**
   * Handle upload start event
   * Called when file upload process begins
   */
  private handleUploadStart(): void {
    console.log("File upload started");

    // Get the drag drop UI and make sure it's reset
    const dragDropUI = this.fileUploadUI.getDragDropUI();
    dragDropUI.hideDropZoneOnly();
  }

  /**
   * Handle upload complete event from custom event
   * @param e - The custom event containing upload details
   */
  private handleUploadCompleteEvent(e: Event): void {
    console.log("Upload complete event received");
    const customEvent = e as CustomEvent;
    if (customEvent.detail) {
      const { filesAdded, totalFiles } = customEvent.detail;
      this.handleUploadComplete(filesAdded, totalFiles);
    }
  }

  /**
   * Handle upload complete with the file details
   * @param filesAdded - Number of files successfully added
   * @param totalFiles - Total number of files attempted
   */
  private handleUploadComplete(filesAdded?: number, totalFiles?: number): void {
    console.log(
      `File upload completed: ${filesAdded} of ${totalFiles} files added`,
    );
  }
}

/**
 * Initialize the file upload functionality
 * Creates a new FileUploadController instance
 */
export async function initializeFileUpload(): Promise<void> {
  try { localStorage.removeItem("textverktyg_recent_files"); } catch { /* Storage may be disabled. */ }
  const response = await fetch("/upload/config");
  if (!response.ok) throw new Error("Dokumentuppladdning kunde inte startas. Ladda om sidan och försök igen.");
  const { data } = await response.json();
  if (!Number.isInteger(data?.maxFileSizeMB) || data.maxFileSizeMB < 1 || data.maxFileSizeMB > 100) throw new Error("Ogiltig filstorleksgräns från servern.");
  fileLimits.maxFileSize = data.maxFileSizeMB * 1024 * 1024;
  console.log("Initializing file upload functionality");
  new FileUploadController();
  console.log("File upload functionality initialized");
}
