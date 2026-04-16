/**
 * WWW Fetcher Modal Component
 * Handles the modal functionality for fetching text from web URLs
 */

/**
 * Interface for modal elements
 */
interface ModalElements {
  modal: HTMLElement;
  closeButton: HTMLElement;
  cancelButton: HTMLButtonElement;
  submitButton: HTMLButtonElement;
  urlInput: HTMLInputElement;
  form: HTMLFormElement;
}

/**
 * Interface for web fetch API response
 */
interface WebFetchResponse {
  success: boolean;
  data?: {
    content: string;
    url: string;
    contentLength: number;
    processingTime: number;
  };
  error?: string;
}

/**
 * Check if URL is the set domain domain
 * @param url - URL to validate
 * @returns boolean indicating if URL is from allowed domain
 */
function isSetDomainUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Allow www.regionstockholm.se and regionstockholm.se as domains to scrape from
    return (
      hostname === "www.regionstockholm.se" || hostname === "regionstockholm.se"
    );
  } catch {
    return false;
  }
}

/**
 * Fetch web content from URL using the API
 * @param url - URL to fetch content from
 * @returns Promise with the fetched content
 */
async function fetchWebContent(url: string): Promise<string> {
  console.log(`[WWW Fetcher] Fetching content from: ${url}`);

  const response = await fetch("/api/fetch-web", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      url,
    }),
  });

  console.log(
    `[WWW Fetcher] Response status: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: WebFetchResponse = await response.json();
  console.log(`[WWW Fetcher] Response data:`, data);

  if (!data.success) {
    console.error(`[WWW Fetcher] API returned error:`, data.error);
    throw new Error(data.error || "Failed to fetch web content");
  }

  const content = data.data?.content || "";
  console.log(
    `[WWW Fetcher] Extracted content length: ${content.length} characters`,
  );

  if (!content || content.trim().length === 0) {
    console.error(`[WWW Fetcher] No content found in response`);
    throw new Error("No content found in the response");
  }

  return content;
}

/**
 * Replace all content in the text input area with fetched content
 * @param content - Content to replace with
 */
function insertContentIntoTextArea(content: string): void {
  // Find the main text input area
  const textArea = document.getElementById("text-input") as HTMLTextAreaElement;

  if (!textArea) {
    console.error("Text input area not found");
    return;
  }

  // Replace all content with the new content
  textArea.value = content;

  // Set cursor position at the beginning
  textArea.setSelectionRange(0, 0);

  // Focus the text area
  textArea.focus();

  // Trigger input event to update any listeners (like character counters)
  textArea.dispatchEvent(
    new Event("input", {
      bubbles: true,
    }),
  );
}

/**
 * Get all modal elements from the DOM
 */
function getModalElements(): ModalElements | null {
  const modal = document.getElementById("www-fetcher-modal");
  const closeButton = document.getElementById("www-fetcher-modal-close");
  const cancelButton = document.getElementById(
    "www-fetcher-cancel",
  ) as HTMLButtonElement;
  const submitButton = document.getElementById(
    "www-fetcher-submit",
  ) as HTMLButtonElement;
  const urlInput = document.getElementById("www-url-input") as HTMLInputElement;
  const form = document.getElementById("modal-form") as HTMLFormElement;

  if (
    !modal ||
    !closeButton ||
    !cancelButton ||
    !submitButton ||
    !urlInput ||
    !form
  ) {
    console.error("WWW Fetcher Modal: Required elements not found");
    return null;
  }

  return {
    modal,
    closeButton,
    cancelButton,
    submitButton,
    urlInput,
    form,
  };
}

/**
 * Show the modal
 */
function showModal(elements: ModalElements): void {
  console.log("WWW Fetcher Modal: Showing modal");

  // Clear previous input
  elements.urlInput.value = "";

  // Use the native dialog showModal() method
  const dialog = elements.modal as HTMLDialogElement;
  dialog.showModal();

  // Focus on the input field after a short delay to ensure smooth animation
  setTimeout(
    () => {
      elements.urlInput.focus();
    },

    50,
  );
}

/**
 * Hide the modal
 */
function hideModal(elements: ModalElements): void {
  console.log("WWW Fetcher Modal: Hiding modal");

  // Use the native dialog close() method
  const dialog = elements.modal as HTMLDialogElement;
  dialog.close();
}

/**
 * Handle escape key press
 */
function handleEscapeKey(elements: ModalElements, event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hideModal(elements);
  }
}

/**
 * Validates URL input
 * @param url - URL to validate
 * @param elements - Modal elements
 * @returns True if URL is valid
 */
function validateUrlInput(url: string, elements: ModalElements): boolean {
  if (!url) {
    console.warn("WWW Fetcher Modal: No URL provided");
    elements.urlInput.focus();
    return false;
  }

  try {
    new URL(url);
  } catch (error) {
    console.warn("WWW Fetcher Modal: Invalid URL provided");
    alert("Ogiltig URL. Kontrollera att webbadressen är korrekt.");
    elements.urlInput.focus();
    return false;
  }

  if (!isSetDomainUrl(url)) {
    alert("Det går endast att hämta texter från www.regionstockholm.se");
    elements.urlInput.focus();
    return false;
  }

  return true;
}

/**
 * Disables form elements during fetch
 * @param elements - Modal elements
 */
function disableFormElements(elements: ModalElements): void {
  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Hämtar...";
  elements.urlInput.disabled = true;
  elements.cancelButton.disabled = true;
}

/**
 * Enables form elements after fetch
 * @param elements - Modal elements
 */
function enableFormElements(elements: ModalElements): void {
  elements.submitButton.disabled = false;
  elements.submitButton.textContent = "Hämta text";
  elements.urlInput.disabled = false;
  elements.cancelButton.disabled = false;
}

/**
 * Handles form submission
 * @param elements - Modal elements
 * @param hideModalWithListeners - Function to hide modal
 */
function setupFormSubmission(
  elements: ModalElements,
  hideModalWithListeners: () => void,
): void {
  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const url = elements.urlInput.value.trim();

    if (!validateUrlInput(url, elements)) {
      return;
    }

    console.log("WWW Fetcher Modal: Form submitted with URL:", url);
    disableFormElements(elements);

    try {
      const content = await fetchWebContent(url);

      if (content) {
        insertContentIntoTextArea(content);
        hideModalWithListeners();
        console.log(
          `Successfully fetched and inserted ${content.length} characters from ${url}`,
        );
      } else {
        console.error(
          "[WWW Fetcher] Empty content returned from fetchWebContent",
        );
        throw new Error("Ingen text hittades på webbsidan");
      }
    } catch (error) {
      console.error("Error fetching web content:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WWW Fetcher] Error occurred:`, errorMessage);
      alert(`Fel vid hämtning av webbsida:\n${errorMessage}`);
    } finally {
      enableFormElements(elements);
    }
  });
}

/**
 * Minimum length for URL validation to avoid premature validation
 * A valid URL needs at least "https://" (8 chars) + domain (2+ chars) = 10+ chars minimum
 */
const MIN_URL_LENGTH_FOR_VALIDATION = 10;

/**
 * Sets up URL input validation
 * @param elements - Modal elements
 */
function setupUrlInputValidation(elements: ModalElements): void {
  elements.urlInput.addEventListener("input", () => {
    const url = elements.urlInput.value.trim();

    if (url && url.length > MIN_URL_LENGTH_FOR_VALIDATION) {
      try {
        new URL(url);

        // Need to set the domain as a variable
        if (!isSetDomainUrl(url)) {
          elements.urlInput.setCustomValidity(
            "Det går endast att hämta texter från www.regionstockholm.se",
          );
        } else {
          elements.urlInput.setCustomValidity("");
        }
      } catch {
        elements.urlInput.setCustomValidity("");
      }
    } else {
      elements.urlInput.setCustomValidity("");
    }
  });
}

/**
 * Sets up modal backdrop click handling
 * @param elements - Modal elements
 * @param hideModalWithListeners - Function to hide modal
 */
function setupBackdropClick(
  elements: ModalElements,
  hideModalWithListeners: () => void,
): void {
  elements.modal.addEventListener("click", () => {
    hideModalWithListeners();
  });

  const modalContent = elements.modal.querySelector(".modal-content");
  if (modalContent) {
    modalContent.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  } else {
    console.warn(
      "WWW Fetcher Modal: .modal-content element not found - backdrop click may not work properly",
    );
  }
}

/**
 * Initialize the WWW Fetcher Modal
 */
export function initializeWwwFetcherModal(): boolean {
  console.log("WWW Fetcher Modal: Initializing...");

  try {
    const triggerButton = document.getElementById("www-fetcher-button");

    if (!triggerButton) {
      console.error("WWW Fetcher Modal: Trigger button not found");
      return false;
    }

    const elements = getModalElements();
    if (!elements) {
      return false;
    }

    // Check if already initialized
    if ((triggerButton as any).wwwFetcherInitialized) {
      console.log("WWW Fetcher Modal: Already initialized, skipping");
      return true;
    }

    (triggerButton as any).wwwFetcherInitialized = true;

    // Create escape key handler
    const escapeKeyHandler = (event: KeyboardEvent) => {
      handleEscapeKey(elements, event);
    };

    // Enhanced show/hide functions with listeners
    const showModalWithListeners = () => {
      showModal(elements);
      document.addEventListener("keydown", escapeKeyHandler);
    };

    const hideModalWithListeners = () => {
      hideModal(elements);
      document.removeEventListener("keydown", escapeKeyHandler);
    };

    // Set up event listeners
    triggerButton.addEventListener("click", (event) => {
      event.preventDefault();
      showModalWithListeners();
    });

    elements.closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      hideModalWithListeners();
    });

    elements.cancelButton.addEventListener("click", (event) => {
      event.preventDefault();
      hideModalWithListeners();
    });

    setupFormSubmission(elements, hideModalWithListeners);
    setupUrlInputValidation(elements);
    setupBackdropClick(elements, hideModalWithListeners);

    console.log("WWW Fetcher Modal: Initialized successfully");
    return true;
  } catch (error) {
    console.error("WWW Fetcher Modal: Failed to initialize:", error);
    return false;
  }
}

/**
 * Export for global access if needed
 */
export const WwwFetcherModal = {
  initialize: initializeWwwFetcherModal,
};
