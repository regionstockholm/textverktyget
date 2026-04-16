/**
 * Word Modal Component
 * Handles the modal functionality for displaying Word-formatted text for manual copying
 */

/**
 * Interface for modal elements
 */
interface WordModalElements {
  modal: HTMLElement;
  closeButton: HTMLElement;
  closeActionButton: HTMLButtonElement;
  contentDiv: HTMLDivElement;
}

/**
 * Converts text to Word-optimized HTML that preserves formatting better
 * @param text - Plain text to convert
 * @returns Word-optimized HTML
 */
const convertToWordOptimizedHTML = (text: string): string => {
  // Escape HTML entities
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Split into paragraphs first (double line breaks)
  const paragraphs = escaped.split(/\n\n|\r\n\r\n/);

  const htmlParagraphs = paragraphs.map((paragraph) => {
    // Within each paragraph, convert single line breaks to <br> tags
    const linesWithBreaks = paragraph.replace(/\n|\r\n/g, "<br>");
    return `<p style="margin: 0 0 6pt 0; line-height: 1.15; font-family: Calibri, sans-serif; font-size: 11pt;">${linesWithBreaks}</p>`;
  });

  return htmlParagraphs.join("\n");
};

/**
 * Get all modal elements from the DOM
 */
function getWordModalElements(): WordModalElements | null {
  const modal = document.getElementById("word-modal");
  const closeButton = document.getElementById("word-modal-close");
  const closeActionButton = document.getElementById(
    "word-modal-close-action",
  ) as HTMLButtonElement;
  const contentDiv = document.getElementById(
    "word-modal-content",
  ) as HTMLDivElement;

  if (!modal || !closeButton || !closeActionButton || !contentDiv) {
    console.error("Word Modal: Required elements not found");
    return null;
  }

  return {
    modal,
    closeButton,
    closeActionButton,
    contentDiv,
  };
}

/**
 * Show the Word modal with formatted content
 * @param text - The text to display in the modal
 */
function showModal(elements: WordModalElements, text: string): void {
  console.log("Word Modal: Showing modal");

  // Convert text to Word-optimized HTML and set it in the content div
  const formattedHTML = convertToWordOptimizedHTML(text);
  elements.contentDiv.innerHTML = formattedHTML;

  // Use the native dialog showModal() method
  const dialog = elements.modal as HTMLDialogElement;
  dialog.showModal();

  // Focus on the content div for easy text selection
  setTimeout(() => {
    elements.contentDiv.focus();
  }, 50);
}

/**
 * Hide the modal
 */
function hideModal(elements: WordModalElements): void {
  console.log("Word Modal: Hiding modal");

  // Use the native dialog close() method
  const dialog = elements.modal as HTMLDialogElement;
  dialog.close();
}

/**
 * Handle escape key press
 */
function handleEscapeKey(
  elements: WordModalElements,
  event: KeyboardEvent,
): void {
  if (event.key === "Escape") {
    hideModal(elements);
  }
}

/**
 * Initialize the Word Modal
 */
export function initializeWordModal(): boolean {
  console.log("Word Modal: Initializing...");

  try {
    // Get modal elements
    const elements = getWordModalElements();

    if (!elements) {
      return false;
    }

    // Check if already initialized
    if ((elements.modal as any).wordModalInitialized) {
      console.log("Word Modal: Already initialized, skipping");
      return true;
    }

    // Mark as initialized
    (elements.modal as any).wordModalInitialized = true;

    // Create escape key handler that will be added/removed dynamically
    const escapeKeyHandler = (event: KeyboardEvent) => {
      handleEscapeKey(elements, event);
    };

    // Enhanced hide modal function that removes escape listener
    const hideModalWithListeners = () => {
      hideModal(elements);
      // Remove escape key listener when modal is closed
      document.removeEventListener("keydown", escapeKeyHandler);
    };

    // Store the hide function on the modal for external access
    (elements.modal as any).hideWordModal = hideModalWithListeners;

    // Add event listeners

    // Close button click
    elements.closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      hideModalWithListeners();
    });

    // Close action button click
    elements.closeActionButton.addEventListener("click", (event) => {
      event.preventDefault();
      hideModalWithListeners();
    });

    // Dialog backdrop click - close when clicking anywhere on the dialog (viewport)
    elements.modal.addEventListener("click", () => {
      hideModalWithListeners();
    });

    // Prevent dialog from closing when clicking on the modal content
    const modalContent = elements.modal.querySelector(".modal-content");
    if (modalContent) {
      modalContent.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    } else {
      console.warn(
        "Word Modal: .modal-content element not found - backdrop click may not work properly",
      );
    }

    console.log("Word Modal: Initialized successfully");
    return true;
  } catch (error) {
    console.error("Word Modal: Failed to initialize:", error);
    return false;
  }
}

/**
 * Show the Word modal with formatted text
 * @param text - The text to display in the modal
 */
export function showWordModal(text: string): void {
  console.log("Word Modal: Showing modal with text");

  const elements = getWordModalElements();
  if (!elements) {
    console.error("Word Modal: Could not get modal elements");
    return;
  }

  // Add escape key listener when modal is opened
  const escapeKeyHandler = (event: KeyboardEvent) => {
    handleEscapeKey(elements, event);
  };
  document.addEventListener("keydown", escapeKeyHandler);

  // Show the modal with formatted content
  showModal(elements, text);
}

/**
 * Export for global access if needed
 */
export const WordModal = {
  initialize: initializeWordModal,
  show: showWordModal,
};
