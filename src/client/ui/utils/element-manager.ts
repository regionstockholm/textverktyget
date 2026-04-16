/**
 * UI Element Manager Module
 * Handles DOM element operations with safety checks and assertions
 */

import { assert } from "../../safety/assertions.js";
import { UILimits } from "../../../config/shared-config.js";
import { validateNotEmpty } from "../../../utils/safety-utils.js";
import {
  createElement,
  updateElementContent,
  appendChildSafe,
  addClassSafe,
  removeClassSafe,
} from "./dom.js";

// Add logging to track when this module is loaded

/**
 * Interface for required DOM elements
 */
export interface RequiredElements {
  dropZone: HTMLElement;
  fileUploadContainer: HTMLElement;
  fileArea: HTMLElement;
  absoluteArea: HTMLElement;
  relativeArea: HTMLElement;
  fileElemButton: HTMLElement;
  fileList: HTMLElement;
  textInput: HTMLElement;
  removeFilesButton?: HTMLElement;
  errorMessage?: HTMLElement;
  [key: string]: HTMLElement | undefined;
}

/**
 * Interface for file list item configuration
 */
export interface FileListItemConfig {
  fileName: string;
  fileId: string;
  fileSize?: number;
  fileType?: string;
}

/**
 * ElementManager class
 * Handles DOM element operations with safety checks and assertions
 */
export class ElementManager {
  public elements: RequiredElements;

  /**
   * Initialize the ElementManager
   * @param elements - Required DOM elements
   */
  constructor(elements: RequiredElements) {
    assert(
      elements && typeof elements === "object",
      "Elements must be a valid object",
    );
    this.elements = elements;
    this.validateRequiredElements();
    this.setupErrorMessageElement();
    console.log("ElementManager initialized successfully");
  }

  /**
   * Validate that all required DOM elements are present
   */
  private validateRequiredElements(): void {
    const requiredElementKeys = [
      "dropZone",
      "fileUploadContainer",
      "fileArea",
      "absoluteArea",
      "relativeArea",
      "fileElemButton",
      "fileList",
      "textInput",
    ];

    // All loops must have a fixed upper bound
    const keyCount = Math.min(
      requiredElementKeys.length,
      UILimits.MAX_ELEMENT_CHECKS,
    );
    for (let i = 0; i < keyCount; i++) {
      const key = requiredElementKeys[i];
      assert(
        this.elements[key as keyof RequiredElements] !== null &&
          this.elements[key as keyof RequiredElements] !== undefined,
        `Required element "${key}" is missing`,
      );

      // Add additional validation for the element
      const element = this.elements[key as keyof RequiredElements];
      assert(
        element instanceof HTMLElement,
        `Element "${key}" must be an HTMLElement`,
      );
    }
  }

  /**
   * Set up error message element if not already present
   */
  private setupErrorMessageElement(): void {
    // Skip if error message element already exists
    if (this.elements.errorMessage) {
      return;
    }

    // Create a new error message element
    this.elements.errorMessage = createElement("div", {
      className: "attachment-text error-message",
      style: "display: none; color: #B21544;",
    });

    // Find the proper location to insert the error message.
    // This element is still injected at runtime to keep compatibility with
    // existing markup across environments.
    try {
      // Find the button parent container
      const buttonContainer = this.elements.fileElemButton.closest(
        ".flex.flex-column.flex-wrap.gap-2",
      );

      if (buttonContainer) {
        // Find the attachment-text paragraph that follows the button
        const attachmentText =
          buttonContainer.querySelector("p.attachment-text");

        if (attachmentText) {
          // Insert the error message before the attachment text paragraph
          buttonContainer.insertBefore(
            this.elements.errorMessage,
            attachmentText,
          );
          console.log("Error message element inserted before attachment text");
          return;
        }
      }

      // Fallback: Add to DOM if file upload container exists and we couldn't find a better location
      console.log("Using fallback for error message placement");
      if (this.elements.fileUploadContainer) {
        appendChildSafe(
          this.elements.fileUploadContainer,
          this.elements.errorMessage,
        );
      }
    } catch (error) {
      console.error("Error setting up error message element:", error);
      // Final fallback - add to fileUploadContainer
      if (this.elements.fileUploadContainer) {
        appendChildSafe(
          this.elements.fileUploadContainer,
          this.elements.errorMessage,
        );
      }
    }
  }

  /**
   * Get an element by its key
   * @param key - The key of the element to retrieve
   * @returns The requested element or null if not found
   */
  public getElement(key: keyof RequiredElements): HTMLElement | null {
    validateNotEmpty(key as string, "Element key");

    try {
      const element = this.elements[key];
      if (!element) {
        console.warn(`Element "${key}" not found in ElementManager`);
        return null;
      }
      return element;
    } catch (error) {
      console.error(`Error retrieving element "${key}":`, error);
      return null;
    }
  }

  /**
   * Displays an error message
   * @param message - The error message to display
   * @returns True if message was displayed successfully
   */
  public showError(message: string): boolean {
    try {
      // Validate input
      validateNotEmpty(message, "Error message");

      // Initialize error message element if needed
      this.setupErrorMessageElement();

      // Get error message element
      const errorElement = this.elements.errorMessage;
      if (!errorElement) {
        console.error("Error message element is missing");
        return false;
      }

      // Update error message content and show it
      updateElementContent(errorElement, message);
      errorElement.style.display = "block";

      // Show for a fixed duration
      const ERROR_TIMEOUT = 5000; // 5 seconds
      setTimeout(() => {
        this.hideError();
      }, ERROR_TIMEOUT);

      return true;
    } catch (error) {
      console.error("Failed to show error message:", error);
      return false;
    }
  }

  /**
   * Hides the error message
   * @returns True if message was hidden successfully
   */
  public hideError(): boolean {
    try {
      const errorElement = this.elements.errorMessage;
      if (!errorElement) {
        // Not an error condition since the element might not exist yet
        return true;
      }

      // Clear and hide the error message
      updateElementContent(errorElement, "");
      errorElement.style.display = "none";
      return true;
    } catch (error) {
      console.error("Failed to hide error message:", error);
      return false;
    }
  }

  /**
   * Creates a file input element with proper configuration
   * @param acceptedTypes - Array of accepted file extensions
   * @returns The configured file input element
   */
  public createFileInput(acceptedTypes: string[]): HTMLInputElement {
    try {
      assert(Array.isArray(acceptedTypes), "Accepted types must be an array");

      // Allow empty arrays during initialization - they'll be updated later
      if (acceptedTypes.length === 0) {
        console.log(
          "Creating file input with empty accepted types (will be updated later)",
        );
      }

      // Validate each accepted type
      const maxTypesToCheck = Math.min(
        acceptedTypes.length,
        UILimits.MAX_FILE_TYPES,
      );
      for (let i = 0; i < maxTypesToCheck; i++) {
        const acceptedType = acceptedTypes[i];
        if (acceptedType) {
          validateNotEmpty(acceptedType, `Accepted type at index ${i}`);
        }
      }

      // Remove any existing file input with this ID to avoid duplicates
      const existingInput = document.getElementById("fileInputElem");
      if (existingInput && existingInput.parentNode) {
        existingInput.parentNode.removeChild(existingInput);
      }

      const fileInput = createElement("input", {
        type: "file",
        multiple: "true",
        style: "display: none;",
        id: "fileInputElem", // Changed to avoid collision with fileElemButton
        accept: acceptedTypes.length > 0 ? acceptedTypes.join(", ") : "*", // Allow all files initially if no types specified
      }) as HTMLInputElement;

      document.body.appendChild(fileInput);
      console.log(
        "File input element created with accepted types:",
        acceptedTypes.length > 0
          ? acceptedTypes.join(", ")
          : "(empty - will be updated later)",
      );
      return fileInput;
    } catch (error) {
      console.error("Failed to create file input:", error);
      // Create and return a disabled file input to avoid null issues
      const fallbackInput = document.createElement("input");
      fallbackInput.type = "file";
      fallbackInput.disabled = true;
      return fallbackInput;
    }
  }

  /**
   * Creates a new file list item with file information and remove button
   * Supports both new configuration object and legacy parameters
   * @param fileNameOrConfig - File name string or configuration object
   * @param fileId - Optional file ID (for backward compatibility)
   * @returns The created list item element
   */
  public createFileListItem(
    fileNameOrConfig: string | FileListItemConfig,
    fileId?: string,
  ): HTMLElement {
    try {
      // Handle both legacy and new calling styles
      let config: FileListItemConfig;

      if (typeof fileNameOrConfig === "string" && fileId) {
        // Legacy format (filename, fileId)
        config = {
          fileName: fileNameOrConfig,
          fileId: fileId,
        };
      } else if (typeof fileNameOrConfig === "object") {
        // New format (config object)
        config = fileNameOrConfig;
      } else {
        throw new Error("Invalid parameters for createFileListItem");
      }

      assert(typeof config.fileName === "string", "File name must be a string");
      validateNotEmpty(config.fileName, "File name");
      assert(typeof config.fileId === "string", "File ID must be a string");
      validateNotEmpty(config.fileId, "File ID");

      const listItem = createElement("div", {
        className:
          "flex flex-row flex-space-between flex-align-items-center gap-8 word-break-all file-item",
        dataset: { fileId: config.fileId },
      });

      // Create file info container (left side)
      const fileInfoContainer = createElement("div", {
        className: "flex flex-row flex-align-items-center gap-4",
      });

      // Create file icon container with SVG
      const fileIconContainer = createElement("div", {
        className: "file-icon",
      });
      const fileIconSVG = this.getFileIconSVG(config.fileType || "");
      fileIconContainer.innerHTML = fileIconSVG;

      // Create filename span with textContent (SAFE - prevents XSS)
      const fileNameSpan = createElement("span", {});
      fileNameSpan.textContent = config.fileName; // SAFE - Uses textContent instead of innerHTML

      appendChildSafe(fileInfoContainer, fileIconContainer);
      appendChildSafe(fileInfoContainer, fileNameSpan);

      // Add file size if provided
      if (config.fileSize) {
        const fileSizeSpan = createElement("span", {
          className: "file-size",
        });
        fileSizeSpan.textContent = `(${this.formatFileSize(config.fileSize)})`;
        appendChildSafe(fileInfoContainer, fileSizeSpan);
      }

      // Create remove button
      const removeButton = createElement("button", {
        className:
          "flex flex-row flex-justify-content-center flex-align-items-center gap-2 text-sm outline-blue filled-white small-button",
        dataset: {
          action: "remove-file",
          id: config.fileId,
        },
      });

      // Add SVG icon to button (safe - hardcoded SVG)
      removeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3.05 17.2a10 10 0 1 1 13.9-14.4 10 10 0 0 1-13.9 14.4Zm1.41-1.42A8 8 0 1 0 15.78 4.46 8 8 0 0 0 4.46 15.78Zm9.9-8.49-2.83 2.83 2.83 2.83-1.4 1.41-2.84-2.83-2.83 2.83-1.4-1.4 2.82-2.84L5.88 7.3 7.3 5.9l2.83 2.82 2.83-2.83 1.41 1.41Z"></path>
        </svg>
        <span>Ta bort</span>
      `;

      // Assemble the list item
      appendChildSafe(listItem, fileInfoContainer);
      appendChildSafe(listItem, removeButton);

      return listItem;
    } catch (error) {
      console.error("Failed to create file list item:", error);
      // Return a basic div to avoid null issues
      const fallbackItem = document.createElement("div");
      fallbackItem.className = "file-item";
      fallbackItem.textContent = "Error creating file item";
      return fallbackItem;
    }
  }

  /**
   * Returns the appropriate SVG icon for a file type
   * @param fileType - MIME type or file extension
   * @returns SVG markup for the file icon
   */
  private getFileIconSVG(fileType: string): string {
    // Default document icon
    let iconSVG = `<svg viewBox="0 0 35 44" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" width="25" height="31"><path d="M8 11.5h19M8 18.5h19M8 25.5h19M8 32.5h12"></path>
      <rect width="31" height="40" x="2" y="2" rx="7"></rect>
    </svg>`;

    // For images
    if (
      fileType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(fileType)
    ) {
      iconSVG = `<svg viewBox="0 0 35 44" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" width="25" height="31">
        <rect width="31" height="40" x="2" y="2" rx="7"></rect>
        <path d="M8 30l5-5 4 4 8-8 5 5"></path>
        <circle cx="22" cy="14" r="3"></circle>
      </svg>`;
    }

    // For PDFs
    if (fileType === "application/pdf" || fileType.endsWith(".pdf")) {
      iconSVG = `<svg viewBox="0 0 35 44" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" width="25" height="31">
        <rect width="31" height="40" x="2" y="2" rx="7"></rect>
        <path d="M10 22h15M10 15h15M10 29h8"></path>
      </svg>`;
    }

    return iconSVG;
  }

  /**
   * Formats a file size in bytes to a human-readable format
   * @param bytes - File size in bytes
   * @returns Formatted file size string
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const formattedSize = parseFloat((bytes / Math.pow(1024, i)).toFixed(1));

    return `${formattedSize} ${sizes[i]}`;
  }

  /**
   * Updates file area visibility based on file presence
   * @returns True if update was successful
   */
  public updateFileArea(): boolean {
    try {
      const { fileArea, fileList } = this.elements;
      assert(fileArea !== undefined, "fileArea element must exist");
      assert(fileList !== undefined, "fileList element must exist");

      // Check if there are any files
      const hasFiles = fileList.children.length > 0;

      if (hasFiles) {
        addClassSafe(fileArea, "has-files");
      } else {
        removeClassSafe(fileArea, "has-files");
      }

      return true;
    } catch (error) {
      console.error("Failed to update file area:", error);
      return false;
    }
  }

  /**
   * Shows or hides the file upload container based on file presence
   * @param hasFiles - Whether files are present
   * @returns True if update was successful
   */
  public updateFileUploadContainer(hasFiles: boolean): boolean {
    try {
      assert(typeof hasFiles === "boolean", "hasFiles must be a boolean");
      assert(
        !!this.elements.fileUploadContainer,
        "File upload container element is required",
      );

      if (hasFiles) {
        this.elements.fileUploadContainer.classList.add("visible");
      } else {
        this.elements.fileUploadContainer.classList.remove("visible");
      }
      return true;
    } catch (error) {
      console.error("Failed to update file upload container:", error);
      return false;
    }
  }

  /**
   * Clears all items from the file list
   * @returns True if clear operation was successful
   */
  public clearFileList(): boolean {
    try {
      assert(!!this.elements.fileList, "File list element is required");

      while (this.elements.fileList.firstChild) {
        this.elements.fileList.removeChild(this.elements.fileList.firstChild);
      }

      this.updateFileArea();
      this.updateFileUploadContainer(false);
      return true;
    } catch (error) {
      console.error("Failed to clear file list:", error);
      return false;
    }
  }

  /**
   * Gets the count of files in the file list
   * @returns Number of files in the list
   */
  public getFileCount(): number {
    try {
      assert(!!this.elements.fileList, "File list element is required");
      return this.elements.fileList.children.length;
    } catch (error) {
      console.error("Failed to get file count:", error);
      return 0;
    }
  }
}
