/**
 * File Upload UI Module
 * Handles user interface aspects of file uploads
 */

import { assert } from "../../safety/assertions.js";
import {
  ElementManager,
  RequiredElements,
} from "../../ui/utils/element-manager.js";
import { FileInfo } from "../models/file-info.js";
import { DragDropUI, DragDropEvents } from "./drag-drop.js";
import { FileListUI, FileListEvents } from "./file-list.js";
import {
  getElementByIdSafe,
  addEventListenerSafe,
  preventDefaultSafe,
} from "../../ui/utils/dom.js";

/**
 * Interface for upload status events
 */
export interface FileUploadEvents {
  onUploadStart?: () => void;
  onUploadComplete?: (filesAdded: number, totalFiles: number) => void;
  onFileRemove?: (fileId: string) => void;
}

/**
 * FileUploadUI class
 * Handles UI components and interactions for file uploads
 */
export class FileUploadUI {
  private elements: RequiredElements;
  private elementManager: ElementManager;
  private dragDropUI: DragDropUI;
  private fileListUI: FileListUI;
  private fileInput: HTMLInputElement;
  private attachedFiles: Map<string, FileInfo>;
  private uploadEvents: FileUploadEvents;
  private isUploadDisabled: boolean;

  /**
   * Initialize the FileUploadUI
   * @param elements - DOM elements required for file upload functionality
   * @param elementManager - Instance of ElementManager for UI updates
   * @param attachedFiles - Map to store uploaded files
   * @param uploadEvents - Optional event callbacks for upload operations
   */
  constructor(
    elements: RequiredElements,
    elementManager: ElementManager,
    attachedFiles: Map<string, FileInfo>,
    uploadEvents: FileUploadEvents = {},
  ) {
    assert(
      elements && typeof elements === "object",
      "Elements must be a valid object",
    );
    assert(
      elementManager && typeof elementManager === "object",
      "elementManager must be a valid object",
    );
    assert(attachedFiles instanceof Map, "attachedFiles must be a Map");

    this.elements = elements;
    this.elementManager = elementManager;
    this.attachedFiles = attachedFiles;
    this.fileInput = this.createFileInput();
    this.uploadEvents = uploadEvents;
    this.isUploadDisabled = false;

    // Initialize drag-drop UI with event callbacks
    const dragDropEvents: DragDropEvents = {
      onDrop: this.handleDroppedFiles.bind(this),
    };

    this.dragDropUI = new DragDropUI(elements, elementManager, dragDropEvents);

    // Initialize file list UI with event callbacks
    const fileListEvents: FileListEvents = {
      onFileRemove: this.handleFileRemove.bind(this),
    };

    this.fileListUI = new FileListUI(
      elements.fileList,
      attachedFiles,
      fileListEvents,
    );

    // Setup event listeners
    this.setupFileButtonListeners();
    this.setupDragAndDropListeners();
    this.setupUploadCompletionListener();
  }

  /**
   * Create a file input element with the proper attributes
   * @returns The created file input element
   */
  private createFileInput(): HTMLInputElement {
    return this.elementManager.createFileInput([]);
  }

  /**
   * Update the file input's accepted file types
   * @param acceptedTypes - Array of accepted file extensions
   */
  public updateAcceptedFileTypes(acceptedTypes: string[]): void {
    this.fileInput = this.elementManager.createFileInput(acceptedTypes);
  }

  /**
   * Set up event listeners for file button interactions
   */
  private setupFileButtonListeners(): void {
    const { fileElemButton } = this.elements;

    // Button click event to trigger file upload
    addEventListenerSafe(
      fileElemButton,
      "click",
      this.handleFileButtonClick.bind(this),
    );
  }

  /**
   * Set up listener for upload completion events
   */
  private setupUploadCompletionListener(): void {
    document.addEventListener("files-upload-complete", (e: Event) => {
      const customEvent = e as CustomEvent;
      this.enableFileUpload();

      if (this.uploadEvents.onUploadComplete && customEvent.detail) {
        const { filesAdded, totalFiles } = customEvent.detail;
        this.uploadEvents.onUploadComplete(filesAdded, totalFiles);
      }
    });
  }

  /**
   * Handle file button click event
   * @param e - The click event
   */
  private handleFileButtonClick(e: Event): void {
    assert(e instanceof Event, "Event must be a valid Event object");

    e.preventDefault();

    // Check if upload is currently disabled
    if (this.isUploadDisabled) {
      return;
    }

    // Using local variable to avoid deep property access (Rule 9)
    const maxFiles = 10;

    if (this.attachedFiles.size >= maxFiles) {
      this.elementManager.showError(
        `Du kan inte lägga till fler än ${maxFiles} dokument.`,
      );
      return;
    }

    if (this.fileInput) {
      this.fileInput.click();
    } else {
      console.error("File input element is not available");
    }
  }

  /**
   * Handle removing a single file
   * @param fileId - The ID of the file to remove
   */
  private handleFileRemove(fileId: string): void {
    if (this.uploadEvents.onFileRemove) {
      this.uploadEvents.onFileRemove(fileId);
    }
  }

  /**
   * Set up all drag and drop related event listeners
   */
  private setupDragAndDropListeners(): void {
    this.preventDefaultDragBehaviors();
    this.setupDocumentDragListeners();
    this.setupDropZoneDragListeners();

    // Listen for files-dropped custom event for backward compatibility
    document.addEventListener("files-dropped", (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.files) {
        this.handleDroppedFiles(customEvent.detail.files);
      }
    });
  }

  /**
   * Prevent default drag behaviors to avoid browser handling of files
   */
  private preventDefaultDragBehaviors(): void {
    const preventDefault = (e: Event): void => {
      preventDefaultSafe(e);
      e.stopPropagation();
    };

    // Prevent default behavior for drag events at the document level
    document.addEventListener("dragenter", preventDefault, false);
    document.addEventListener("dragover", preventDefault, false);
    document.addEventListener("dragleave", preventDefault, false);
    document.addEventListener("drop", preventDefault, false);
  }

  /**
   * Set up document-level drag event listeners
   */
  private setupDocumentDragListeners(): void {
    // Store bound methods to ensure they work correctly
    const boundHandleDocumentDragEnter =
      this.dragDropUI.handleDocumentDragEnter.bind(this.dragDropUI);
    const boundHandleDocumentDragLeave =
      this.dragDropUI.handleDocumentDragLeave.bind(this.dragDropUI);

    // Add document-level drop handler to hide UI when dropping outside drop zone
    document.addEventListener(
      "drop",
      (e: Event) => {
        preventDefaultSafe(e);
        e.stopPropagation();

        // Always hide drag drop area on any document drop
        this.dragDropUI.hideDragDropArea();
        this.dragDropUI.resetDragState();

        // Let the drop zone's own handler deal with valid drops
      },
      false,
    );

    document.addEventListener("dragenter", boundHandleDocumentDragEnter, false);
    document.addEventListener("dragleave", boundHandleDocumentDragLeave, false);
  }

  /**
   * Set up drop zone specific drag event listeners
   */
  private setupDropZoneDragListeners(): void {
    // Using destructuring to avoid deep property access
    const { dropZone } = this.elements;

    // Store bound methods to ensure they work correctly
    const boundHandleDropZoneDragEnter =
      this.dragDropUI.handleDropZoneDragEnter.bind(this.dragDropUI);
    const boundHandleDropZoneDragLeave =
      this.dragDropUI.handleDropZoneDragLeave.bind(this.dragDropUI);
    const boundHandleDrop = this.dragDropUI.handleDrop.bind(this.dragDropUI);

    dropZone.addEventListener("dragenter", boundHandleDropZoneDragEnter, false);
    dropZone.addEventListener("dragleave", boundHandleDropZoneDragLeave, false);
    dropZone.addEventListener("drop", boundHandleDrop, false);
  }

  /**
   * Handle dropped files, dispatching the event for file manager
   * @param files - The file list from the drop event
   */
  private handleDroppedFiles(files: FileList): void {
    if (this.isUploadDisabled) {
      return;
    }

    if (files && files.length > 0) {
      // Check for max files limit
      const MAX_FILES = 10;
      if (this.attachedFiles.size + files.length > MAX_FILES) {
        this.elementManager.showError(
          `Du kan inte lägga till fler än ${MAX_FILES} dokument.`,
        );
        return;
      }

      // Notify upload start if callback exists
      if (this.uploadEvents.onUploadStart) {
        this.uploadEvents.onUploadStart();
      }

      // Disable further uploads until this one completes
      this.disableFileUpload();

      // Dispatch event with files to be handled by file manager
      const event = new CustomEvent("files-dropped", {
        detail: { files },
      });
      document.dispatchEvent(event);
    }
  }

  /**
   * Disable file upload controls during processing
   */
  public disableFileUpload(): void {
    this.isUploadDisabled = true;
    this.dragDropUI.setActive(false);

    // Add visual indication that upload is disabled
    if (this.elements.fileElemButton) {
      this.elements.fileElemButton.classList.add("disabled");
    }
  }

  /**
   * Enable file upload controls after processing
   */
  public enableFileUpload(): void {
    this.isUploadDisabled = false;
    this.dragDropUI.setActive(true);

    // Remove visual indication
    if (this.elements.fileElemButton) {
      this.elements.fileElemButton.classList.remove("disabled");
    }
  }

  /**
   * Get the file input element
   * @returns The file input element
   */
  public getFileInput(): HTMLInputElement {
    return this.fileInput;
  }

  /**
   * Get the DragDropUI instance
   * @returns The DragDropUI instance
   */
  public getDragDropUI(): DragDropUI {
    return this.dragDropUI;
  }

  /**
   * Get the FileListUI instance
   * @returns The FileListUI instance
   */
  public getFileListUI(): FileListUI {
    return this.fileListUI;
  }

  /**
   * Set event callbacks for file upload operations
   * @param events - Object containing event callbacks
   */
  public setUploadEvents(events: FileUploadEvents): void {
    this.uploadEvents = { ...this.uploadEvents, ...events };
  }

  /**
   * Check if file upload is currently disabled
   * @returns True if file upload is disabled
   */
  public isUploadInProgress(): boolean {
    return this.isUploadDisabled;
  }

  /**
   * Static method to initialize all required DOM elements
   * @returns Object containing all required DOM elements
   */
  public static initializeElements(): RequiredElements {
    const dropZone = getElementByIdSafe("drop-zone");
    const absoluteArea = getElementByIdSafe("absolute-area");
    const relativeArea = getElementByIdSafe("relative-area");
    const fileUploadContainer = getElementByIdSafe("file-upload-container");
    const fileElemButton = getElementByIdSafe("fileElemButton");
    const fileList = getElementByIdSafe("file-list");
    const fileArea = getElementByIdSafe("file-area");
    const textInput = getElementByIdSafe("text-input");

    // Validate all elements are present
    assert(dropZone instanceof HTMLElement, "dropZone element not found");
    assert(
      absoluteArea instanceof HTMLElement,
      "absoluteArea element not found",
    );
    assert(
      relativeArea instanceof HTMLElement,
      "relativeArea element not found",
    );
    assert(
      fileUploadContainer instanceof HTMLElement,
      "fileUploadContainer element not found",
    );
    assert(
      fileElemButton instanceof HTMLElement,
      "fileElemButton element not found",
    );
    assert(fileList instanceof HTMLElement, "fileList element not found");
    assert(fileArea instanceof HTMLElement, "fileArea element not found");
    assert(textInput instanceof HTMLElement, "textInput element not found");

    return {
      dropZone,
      absoluteArea,
      relativeArea,
      fileUploadContainer,
      fileElemButton,
      fileList,
      fileArea,
      textInput,
    };
  }

  /**
   * Add a file to the UI list
   * @param fileId - The ID of the file
   * @param fileInfo - The file information
   */
  public addFileToList(fileId: string, fileInfo: FileInfo): void {
    this.fileListUI.addFile(fileId, fileInfo);
  }

  /**
   * Remove a file from the UI list
   * @param fileId - The ID of the file to remove
   */
  public removeFileFromList(fileId: string): void {
    this.fileListUI.removeFile(fileId);
  }

  /**
   * Clear all files from the UI list
   */
  public clearFileList(): void {
    this.fileListUI.clearAllFiles();
  }

  /**
   * Update file status in the UI
   * @param fileId - The ID of the file to update
   * @param status - The status text to display
   * @param isError - Whether the status is an error
   */
  public updateFileStatus(
    fileId: string,
    status: string,
    isError: boolean = false,
  ): void {
    this.fileListUI.updateFileStatus(fileId, status, isError);
  }
}
