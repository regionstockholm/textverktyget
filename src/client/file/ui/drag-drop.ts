/**
 * Drag and Drop UI Module
 * Handles the user interface aspects of drag and drop file uploads
 */

import { assert } from "../../safety/assertions.js";
import {
  ElementManager,
  RequiredElements,
} from "../../ui/utils/element-manager.js";
import { preventDefaultSafe } from "../../ui/utils/dom.js";

/**
 * Interface for drag drop events
 */
export interface DragDropEvents {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: (files: FileList) => void;
}

/**
 * DragDropUI class
 * Handles visual feedback and UI state management during drag operations.
 */
export class DragDropUI {
  private elements: RequiredElements;
  private elementManager: ElementManager;
  private dragCounter: number;
  private isOverDropZone: boolean;
  private events: DragDropEvents;
  private isActive: boolean;
  private dragEndHandler: (e: DragEvent) => void;
  private dragTimeoutId: number | null;

  /**
   * Initialize the DragDropUI
   * @param elements - DOM elements required for drag and drop functionality
   * @param elementManager - Instance of ElementManager for UI updates
   * @param events - Optional event callbacks for drag and drop operations
   */
  constructor(
    elements: RequiredElements,
    elementManager: ElementManager,
    events: DragDropEvents = {},
  ) {
    assert(
      elements && typeof elements === "object",
      "Elements must be a valid object",
    );
    assert(
      elements.dropZone instanceof HTMLElement,
      "dropZone must be an HTMLElement",
    );
    assert(
      elements.absoluteArea instanceof HTMLElement,
      "absoluteArea must be an HTMLElement",
    );
    assert(
      elements.relativeArea instanceof HTMLElement,
      "relativeArea must be an HTMLElement",
    );
    assert(
      elements.fileUploadContainer instanceof HTMLElement,
      "fileUploadContainer must be an HTMLElement",
    );
    assert(
      elementManager && typeof elementManager === "object",
      "elementManager must be a valid object",
    );
    assert(
      typeof elementManager.updateFileUploadContainer === "function",
      "elementManager must have updateFileUploadContainer method",
    );

    this.elements = elements;
    this.elementManager = elementManager;
    this.dragCounter = 0;
    this.isOverDropZone = false;
    this.events = events;
    this.isActive = true;
    this.dragTimeoutId = null;

    // Create bound dragend handler for reliable cleanup
    this.dragEndHandler = this.handleDragEnd.bind(this);
  }

  /**
   * Shows the drag and drop area when files are being dragged
   */
  showDragDropArea(): void {
    if (!this.isActive) {
      return;
    }

    this.showFileUploadContainer();
    this.elements.absoluteArea.classList.add("visible");
    this.elements.dropZone.classList.add("visible");
    this.elements.relativeArea.classList.add("drag-drop");

    // Add dragend listener when drag area becomes visible
    document.addEventListener("dragend", this.dragEndHandler);

    // Safety timeout to prevent drag area from getting stuck
    // Clear any existing timeout first
    if (this.dragTimeoutId !== null) {
      window.clearTimeout(this.dragTimeoutId);
    }

    // Set a timeout to automatically hide the drag area after 10 seconds.
    // This prevents the UI from getting stuck if drag events are missed
    this.dragTimeoutId = window.setTimeout(() => {
      this.resetDragState();
      this.hideDragDropArea();
    }, 10000);

    if (this.events.onDragStart) {
      this.events.onDragStart();
    }
  }

  /**
   * Hides the drag and drop area and resets UI state
   */
  hideDragDropArea(): void {
    this.elements.dropZone.classList.remove("visible", "highlight");
    this.elements.absoluteArea.classList.remove("visible");
    this.elements.relativeArea.classList.remove("drag-drop");
    this.hideFileUploadContainer();

    // Remove dragend listener when drag area is hidden
    document.removeEventListener("dragend", this.dragEndHandler);

    // Clear the safety timeout
    if (this.dragTimeoutId !== null) {
      window.clearTimeout(this.dragTimeoutId);
      this.dragTimeoutId = null;
    }

    if (this.events.onDragEnd) {
      this.events.onDragEnd();
    }
  }

  /**
   * Hides only the drop zone overlay while keeping other elements visible
   */
  hideDropZoneOnly(): void {
    this.elements.dropZone.classList.remove("visible", "highlight");
    this.elements.absoluteArea.classList.remove("visible");
    this.elements.relativeArea.classList.remove("drag-drop");
  }

  /**
   * Shows the file upload container with animation frame for smooth transition
   */
  showFileUploadContainer(): void {
    requestAnimationFrame(() => {
      this.elementManager.updateFileUploadContainer(true);
    });
  }

  /**
   * Hides the file upload container if no files are present
   */
  hideFileUploadContainer(): void {
    if (
      !this.elements.fileList ||
      this.elements.fileList.children.length === 0
    ) {
      this.elementManager.updateFileUploadContainer(false);
    }
  }

  /**
   * Handles dragenter event on document level
   */
  handleDocumentDragEnter = (e: DragEvent): void => {
    assert(e instanceof Event, "Event must be a valid Event object");

    preventDefaultSafe(e);
    e.stopPropagation();

    // Check for file max limit before showing the drop zone
    const MAX_FILES = 10;
    if (
      this.elements.fileList &&
      this.elements.fileList.children.length >= MAX_FILES
    ) {
      return;
    }

    if (!this.isOverDropZone) {
      this.dragCounter++;
      if (this.dragCounter === 1) {
        this.showDragDropArea();
      }
    }
  };

  /**
   * Handles dragleave event on document level
   */
  handleDocumentDragLeave = (e: DragEvent): void => {
    assert(e instanceof Event, "Event must be a valid Event object");

    preventDefaultSafe(e);
    e.stopPropagation();

    if (!this.isOverDropZone) {
      this.dragCounter--;

      // Reset counter if cursor leaves the window
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        this.dragCounter = 0;
      }

      if (this.dragCounter === 0) {
        this.hideDragDropArea();
      }
    }
  };

  /**
   * Handles dragenter event when cursor enters the drop zone
   */
  handleDropZoneDragEnter = (e: DragEvent): void => {
    assert(e instanceof Event, "Event must be a valid Event object");

    preventDefaultSafe(e);
    e.stopPropagation();

    this.isOverDropZone = true;
    this.elements.dropZone.classList.add("highlight");
  };

  /**
   * Handles dragleave event when cursor leaves the drop zone
   */
  handleDropZoneDragLeave = (e: DragEvent): void => {
    assert(e instanceof Event, "Event must be a valid Event object");

    preventDefaultSafe(e);
    e.stopPropagation();

    const rect = this.elements.dropZone.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Only remove highlight if cursor is actually outside the drop zone
    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      this.isOverDropZone = false;
      this.elements.dropZone.classList.remove("highlight");
    }
  };

  /**
   * Handles drop event directly
   */
  handleDrop = (e: DragEvent): void => {
    assert(e instanceof Event, "Event must be a valid Event object");

    preventDefaultSafe(e);
    e.stopPropagation();

    // Reset state
    this.resetDragState();

    // Check if drop zone is active
    if (!this.isActive) {
      return;
    }

    if (this.isDropOutsideDropZone(e)) {
      // Hide the drag drop area completely when dropping outside the zone
      this.hideDragDropArea();
      return;
    }

    // Access files from the dataTransfer
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      if (this.events.onDrop) {
        this.events.onDrop(dt.files);
      }
    }
  };

  /**
   * Checks if a drop event occurred outside the drop zone
   */
  private isDropOutsideDropZone(e: DragEvent): boolean {
    assert(e instanceof Event, "Event must be a valid Event object");

    const rect = this.elements.dropZone.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;

    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
  }

  /**
   * Reset drag state counters and flags
   */
  public resetDragState(): void {
    this.dragCounter = 0;
    this.isOverDropZone = false;
  }

  /**
   * Enable or disable drag-drop functionality
   */
  setActive(isActive: boolean): void {
    this.isActive = isActive;
    if (!isActive && this.dragCounter > 0) {
      this.hideDragDropArea();
      this.resetDragState();
    }
  }

  /**
   * Handles dragend event for reliable cleanup
   * Similar to how modal handles backdrop clicks - provides reliable cleanup
   * when user stops dragging regardless of where they are
   */
  private handleDragEnd = (e: DragEvent): void => {
    assert(e instanceof Event, "Event must be a valid Event object");

    preventDefaultSafe(e);
    e.stopPropagation();

    // Reset all drag state and hide the drag area
    this.resetDragState();
    this.hideDragDropArea();
  };
}
