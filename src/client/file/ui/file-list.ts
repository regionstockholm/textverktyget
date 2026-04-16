/**
 * File List UI Module
 * Handles the rendering and interaction with the list of uploaded files
 */

import { assert } from "../../safety/assertions.js";
import { FileInfo } from "../models/file-info.js";
import { addEventListenerSafe } from "../../ui/utils/dom.js";

/**
 * Interface for file list events
 */
export interface FileListEvents {
  onFileRemove?: (fileId: string) => void;
}

/**
 * FileListUI class
 * Handles rendering and interaction with the file list in the UI
 */
export class FileListUI {
  private fileListElement: HTMLElement;
  private events: FileListEvents;

  /**
   * Initialize the FileListUI
   * @param fileListElement - The DOM element that contains the file list
   * @param attachedFiles - Map to store uploaded files
   * @param events - Optional event callbacks for file list operations
   */
  constructor(
    fileListElement: HTMLElement,
    attachedFiles: Map<string, FileInfo>,
    events: FileListEvents = {},
  ) {
    assert(
      fileListElement instanceof HTMLElement,
      "fileListElement must be an HTMLElement",
    );
    assert(attachedFiles instanceof Map, "attachedFiles must be a Map");

    this.fileListElement = fileListElement;
    this.events = events;
  }

  /**
   * Add a file to the list
   * @param fileId - The ID of the file
   * @param fileInfo - The file information to add
   */
  addFile(fileId: string, fileInfo: FileInfo): void {
    assert(typeof fileId === "string", "fileId must be a string");
    assert(
      fileInfo && typeof fileInfo === "object",
      "fileInfo must be a valid object",
    );
    assert(fileInfo.file instanceof File, "fileInfo.file must be a File");

    // Create the list item for the file
    const fileItem = document.createElement("li");
    fileItem.id = `file-item-${fileId}`;
    fileItem.className = "file-item";
    fileItem.dataset.fileId = fileId;

    // Create the file name element
    const fileName = document.createElement("span");
    fileName.className = "file-name";
    fileName.textContent = fileInfo.fileName || fileInfo.file.name;

    // Create the file size element
    const fileSize = document.createElement("span");
    fileSize.className = "file-size";
    fileSize.textContent = this.formatFileSize(fileInfo.file.size);

    // Create the status element
    const fileStatus = document.createElement("span");
    fileStatus.className = "file-status";
    fileStatus.id = `file-status-${fileId}`;

    // Create the remove button
    const removeButton = document.createElement("button");
    removeButton.className = "remove-file";
    removeButton.setAttribute("aria-label", "Ta bort fil");
    removeButton.innerHTML = "&#10005;"; // X symbol

    // Add event listener to remove button
    addEventListenerSafe(removeButton, "click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.events.onFileRemove) {
        this.events.onFileRemove(fileId);
      }
    });

    // Assemble the file item
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileSize);
    fileItem.appendChild(fileStatus);
    fileItem.appendChild(removeButton);

    // Add to the DOM
    this.fileListElement.appendChild(fileItem);
  }

  /**
   * Remove a file from the list
   * @param fileId - The ID of the file to remove
   */
  removeFile(fileId: string): void {
    assert(typeof fileId === "string", "fileId must be a string");

    const fileItem = document.getElementById(`file-item-${fileId}`);
    if (fileItem && fileItem.parentNode) {
      fileItem.parentNode.removeChild(fileItem);
    }
  }

  /**
   * Clear all files from the list
   */
  clearAllFiles(): void {
    while (this.fileListElement.firstChild) {
      this.fileListElement.removeChild(this.fileListElement.firstChild);
    }
  }

  /**
   * Update the status of a file in the list
   * @param fileId - The ID of the file to update
   * @param status - The new status text
   * @param isError - Whether the status is an error
   */
  updateFileStatus(
    fileId: string,
    status: string,
    isError: boolean = false,
  ): void {
    assert(typeof fileId === "string", "fileId must be a string");

    const statusElement = document.getElementById(`file-status-${fileId}`);
    if (statusElement) {
      statusElement.textContent = status;

      // Reset classes first
      statusElement.classList.remove("error", "success", "processing");

      // Apply appropriate class
      if (isError) {
        statusElement.classList.add("error");
      } else if (status === "Färdig") {
        statusElement.classList.add("success");
      } else {
        statusElement.classList.add("processing");
      }
    }
  }

  /**
   * Format file size to a human-readable string
   * @param bytes - The file size in bytes
   * @returns Formatted file size string
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Get the number of files in the list
   * @returns The number of files
   */
  getFileCount(): number {
    return this.fileListElement.children.length;
  }

  /**
   * Check if the list contains files
   * @returns True if the list has files
   */
  hasFiles(): boolean {
    return this.fileListElement.children.length > 0;
  }
}
