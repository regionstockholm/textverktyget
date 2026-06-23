import { ElementManager } from "./element-manager.js";
import type { RequiredElements } from "./element-manager.js";

/**
 * Interface for drag drop events
 */
export type DragDropEvents = {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: (files: FileList) => void;
};

const MAX_FILES = 10;
const DRAG_TIMEOUT_MS = 10000;

function stopDragEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
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
    this.elements = elements;
    this.elementManager = elementManager;
    this.dragCounter = 0;
    this.isOverDropZone = false;
    this.events = events;
    this.isActive = true;
    this.dragTimeoutId = null;

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

    document.addEventListener("dragend", this.dragEndHandler);
    this.clearDragTimeout();
    this.dragTimeoutId = window.setTimeout(() => {
      this.resetDragState();
      this.hideDragDropArea();
    }, DRAG_TIMEOUT_MS);

    this.events.onDragStart?.();
  }

  /**
   * Hides the drag and drop area and resets UI state
   */
  hideDragDropArea(): void {
    this.elements.dropZone.classList.remove("visible", "highlight");
    this.elements.absoluteArea.classList.remove("visible");
    this.elements.relativeArea.classList.remove("drag-drop");
    this.hideFileUploadContainer();

    document.removeEventListener("dragend", this.dragEndHandler);
    this.clearDragTimeout();

    this.events.onDragEnd?.();
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
    if (this.elements.fileList.children.length === 0) {
      this.elementManager.updateFileUploadContainer(false);
    }
  }

  /**
   * Handles dragenter event on document level
   */
  handleDocumentDragEnter = (e: DragEvent): void => {
    stopDragEvent(e);

    if (this.elements.fileList.children.length >= MAX_FILES || this.isOverDropZone) {
      return;
    }

    this.dragCounter += 1;
    if (this.dragCounter === 1) {
      this.showDragDropArea();
    }
  };

  /**
   * Handles dragleave event on document level
   */
  handleDocumentDragLeave = (e: DragEvent): void => {
    stopDragEvent(e);

    if (this.isOverDropZone) {
      return;
    }

    if (
      e.clientY <= 0 ||
      e.clientX <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight
    ) {
      this.dragCounter = 0;
    } else {
      this.dragCounter = Math.max(0, this.dragCounter - 1);
    }

    if (this.dragCounter === 0) {
      this.hideDragDropArea();
    }
  };

  /**
   * Handles dragenter event when cursor enters the drop zone
   */
  handleDropZoneDragEnter = (e: DragEvent): void => {
    stopDragEvent(e);
    this.isOverDropZone = true;
    this.elements.dropZone.classList.add("highlight");
  };

  /**
   * Handles dragleave event when cursor leaves the drop zone
   */
  handleDropZoneDragLeave = (e: DragEvent): void => {
    stopDragEvent(e);

    const rect = this.elements.dropZone.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

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
    stopDragEvent(e);

    this.resetDragState();

    if (!this.isActive) {
      return;
    }

    if (this.isDropOutsideDropZone(e)) {
      this.hideDragDropArea();
      return;
    }

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.events.onDrop?.(files);
    }
  };

  /**
   * Checks if a drop event occurred outside the drop zone
   */
  private isDropOutsideDropZone(e: DragEvent): boolean {
    const rect = this.elements.dropZone.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;

    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
  }

  private clearDragTimeout(): void {
    if (this.dragTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.dragTimeoutId);
    this.dragTimeoutId = null;
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
    stopDragEvent(e);
    this.resetDragState();
    this.hideDragDropArea();
  };
}
