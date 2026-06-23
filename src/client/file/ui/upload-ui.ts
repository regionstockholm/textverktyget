import { ElementManager } from "./element-manager.js";
import type { RequiredElements } from "./element-manager.js";
import type { FileInfo } from "../models/file-info.js";
import { DragDropUI } from "./drag-drop.js";
import { requireById } from "../../ui/utils/dom.js";
import { fileLimits } from "../../../config/shared-config.js";

/**
 * Interface for upload status events
 */
export type FileUploadEvents = {
  onUploadStart?: () => void;
  onUploadComplete?: (filesAdded: number, totalFiles: number) => void;
};

const filesDroppedEvent = "files-dropped";
const filesUploadCompleteEvent = "files-upload-complete";

function stopDragEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * FileUploadUI class
 * Handles UI components and interactions for file uploads
 */
export class FileUploadUI {
  private elements: RequiredElements;
  private elementManager: ElementManager;
  private dragDropUI: DragDropUI;
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
    this.elements = elements;
    this.elementManager = elementManager;
    this.attachedFiles = attachedFiles;
    this.fileInput = this.elementManager.createFileInput([]);
    this.uploadEvents = uploadEvents;
    this.isUploadDisabled = false;

    this.dragDropUI = new DragDropUI(elements, elementManager, {
      onDrop: this.handleDroppedFiles.bind(this),
    });

    this.setupFileButtonListeners();
    this.setupDragAndDropListeners();
    this.setupUploadCompletionListener();
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
    this.elements.fileElemButton.addEventListener(
      "click",
      this.handleFileButtonClick.bind(this),
    );
  }

  /**
   * Set up listener for upload completion events
   */
  private setupUploadCompletionListener(): void {
    document.addEventListener(filesUploadCompleteEvent, (event: Event) => {
      this.enableFileUpload();

      const customEvent = event as CustomEvent<{
        filesAdded: number;
        totalFiles: number;
      }>;
      const detail = customEvent.detail;

      if (this.uploadEvents.onUploadComplete && detail) {
        const { filesAdded, totalFiles } = detail;
        this.uploadEvents.onUploadComplete(filesAdded, totalFiles);
      }
    });
  }

  /**
   * Handle file button click event
   * @param e - The click event
   */
  private handleFileButtonClick(e: Event): void {
    e.preventDefault();

    if (this.isUploadDisabled) {
      return;
    }

    if (this.attachedFiles.size >= fileLimits.maxFiles) {
      this.elementManager.showError(
        `Du kan inte lägga till fler än ${fileLimits.maxFiles} dokument.`,
      );
      return;
    }

    this.fileInput.click();
  }

  /**
   * Set up all drag and drop related event listeners
   */
  private setupDragAndDropListeners(): void {
    for (const eventName of ["dragenter", "dragover", "dragleave", "drop"]) {
      document.addEventListener(eventName, stopDragEvent, false);
    }

    document.addEventListener(
      "drop",
      (event: Event) => {
        stopDragEvent(event);
        this.dragDropUI.hideDragDropArea();
        this.dragDropUI.resetDragState();
      },
      false,
    );

    document.addEventListener(
      "dragenter",
      this.dragDropUI.handleDocumentDragEnter,
      false,
    );
    document.addEventListener(
      "dragleave",
      this.dragDropUI.handleDocumentDragLeave,
      false,
    );

    this.elements.dropZone.addEventListener(
      "dragenter",
      this.dragDropUI.handleDropZoneDragEnter,
      false,
    );
    this.elements.dropZone.addEventListener(
      "dragleave",
      this.dragDropUI.handleDropZoneDragLeave,
      false,
    );
    this.elements.dropZone.addEventListener(
      "drop",
      this.dragDropUI.handleDrop,
      false,
    );
  }

  /**
   * Handle dropped files, dispatching the event for file manager
   * @param files - The file list from the drop event
   */
  private handleDroppedFiles(files: FileList): void {
    if (this.isUploadDisabled || files.length === 0) {
      return;
    }

    if (this.attachedFiles.size + files.length > fileLimits.maxFiles) {
      this.elementManager.showError(
        `Du kan inte lägga till fler än ${fileLimits.maxFiles} dokument.`,
      );
      return;
    }

    this.uploadEvents.onUploadStart?.();
    this.disableFileUpload();

    document.dispatchEvent(
      new CustomEvent(filesDroppedEvent, {
        detail: { files },
      }),
    );
  }

  /**
   * Disable file upload controls during processing
   */
  public disableFileUpload(): void {
    this.isUploadDisabled = true;
    this.dragDropUI.setActive(false);
    this.elements.fileElemButton.classList.add("disabled");
  }

  /**
   * Enable file upload controls after processing
   */
  public enableFileUpload(): void {
    this.isUploadDisabled = false;
    this.dragDropUI.setActive(true);
    this.elements.fileElemButton.classList.remove("disabled");
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
    return {
      dropZone: requireById("drop-zone"),
      absoluteArea: requireById("absolute-area"),
      relativeArea: requireById("relative-area"),
      fileUploadContainer: requireById("file-upload-container"),
      fileElemButton: requireById("fileElemButton"),
      fileList: requireById("file-list"),
      fileArea: requireById("file-area"),
      textInput: requireById("text-input"),
    };
  }
}
