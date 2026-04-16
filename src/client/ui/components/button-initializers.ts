/**
 * Button Initializers Module
 * Handles initialization of various button types with specific behaviors
 */

import { addEventListenerSafe, querySelectorSafe } from "../utils/dom.js";
import { safetyConfig, UILimits } from "../../../config/shared-config.js";
import { updateButtonState } from "./button-state.js";
import { copyToClipboard } from "./clipboard.js";
import { processSummaryWithQuality } from "../../core/quality/quality-evaluation-client.js";
import {
  textProcessingEvents,
  TextProcessingEventType,
  TextProcessingEventData,
  ProcessingErrorEventData,
} from "../../core/events/text-processing-events.js";
import {
  createAbortController,
  clearAbortController,
} from "../../core/app-state.js";

// Add logging to track when this module is loaded
// Button initializers module

/**
 * Simple assertion function to validate inputs
 * @param condition - The condition to assert
 * @param message - Error message if assertion fails
 * @returns Whether assertion passed
 */
const assert = (condition: boolean, message: string): boolean => {
  if (!condition) {
    console.error(`Assertion failed: ${message}`);
    return false;
  }
  return true;
};

/**
 * Initializes a copy button with clipboard functionality
 * @param copyButton - The copy button element
 * @param getTextToCopy - Function that returns the text to copy
 * @returns Whether initialization was successful
 */
export const initializeCopyButton = (
  copyButton: HTMLButtonElement,
  getTextToCopy: () => string,
): boolean => {
  // Initializing copy button
  if (
    !assert(
      copyButton instanceof HTMLButtonElement,
      "copyButton must be an HTMLButtonElement",
    )
  ) {
    return false;
  }

  if (
    !assert(
      typeof getTextToCopy === "function",
      "getTextToCopy must be a function",
    )
  ) {
    return false;
  }

  // Check if the button has already been initialized
  if ((copyButton as any).hasInitialized) {
    // Copy button already initialized, skipping
    return false;
  }

  // Mark the button as initialized
  (copyButton as any).hasInitialized = true;
  // Marking copy button as initialized

  // Add the click event listener using the safe function
  const listenerAdded = addEventListenerSafe(copyButton, "click", async () => {
    // Copy button clicked
    const textToCopy = getTextToCopy();
    if (!assert(!!textToCopy, "No text available to copy")) {
      return;
    }

    const buttonUpdateSuccess = updateButtonState(copyButton, true);
    assert(buttonUpdateSuccess, "Failed to update button state");

    const copySuccess = await copyToClipboard(textToCopy);
    assert(copySuccess, "Failed to copy text to clipboard");

    // Reset button state after a delay
    const timeoutDuration = Math.min(1500, safetyConfig.MAX_TIMEOUT_DURATION);
    setTimeout(() => {
      updateButtonState(copyButton, false);
    }, timeoutDuration);
  });

  // Copy button event listener setup complete
  return listenerAdded;
};

/**
 * Initializes a Word modal button that opens a modal with formatted text
 * @param modalButton - The modal button element
 * @param getTextToCopy - Function that returns the text to display in modal
 * @returns Whether initialization was successful
 */
export const initializeWordModalButton = (
  modalButton: HTMLButtonElement,
  getTextToCopy: () => string,
): boolean => {
  // Initializing Word modal button
  if (
    !assert(
      modalButton instanceof HTMLButtonElement,
      "modalButton must be an HTMLButtonElement",
    )
  ) {
    return false;
  }

  if (
    !assert(
      typeof getTextToCopy === "function",
      "getTextToCopy must be a function",
    )
  ) {
    return false;
  }

  // Check if the button has already been initialized
  if ((modalButton as any).hasInitialized) {
    // Word modal button already initialized
    return false;
  }

  // Mark the button as initialized
  (modalButton as any).hasInitialized = true;
  // Marking Word modal button as initialized

  // Add the click event listener using the safe function
  const listenerAdded = addEventListenerSafe(modalButton, "click", async () => {
    // Word modal button clicked
    const textToCopy = getTextToCopy();
    if (!assert(!!textToCopy, "No text available to copy")) {
      return;
    }

    // Import and show the Word modal
    try {
      const { showWordModal } = await import("./word-modal.js");
      showWordModal(textToCopy);
    } catch (error) {
      console.error("Failed to show Word modal:", error);
    }
  });

  // Word modal button setup complete
  return listenerAdded;
};

/**
 * Initializes a prompt button that toggles visibility of an element
 * @param promptButton - The prompt button element
 * @param finalPromptElement - The element to toggle visibility
 * @returns Whether initialization was successful
 */
export const initializePromptButton = (
  promptButton: HTMLButtonElement,
  finalPromptElement: HTMLElement,
): boolean => {
  // Initializing prompt button
  // Final prompt element located

  if (
    !assert(
      promptButton instanceof HTMLButtonElement,
      "promptButton must be an HTMLButtonElement",
    )
  ) {
    console.error("[DEBUG] promptButton is not an HTMLButtonElement");
    return false;
  }

  if (
    !assert(
      finalPromptElement instanceof HTMLElement,
      "finalPromptElement must be an HTMLElement",
    )
  ) {
    console.error("[DEBUG] finalPromptElement is not an HTMLElement");
    return false;
  }

  // Check content size to enforce upper bound (Rule 2)
  const contentLength = finalPromptElement.textContent?.length || 0;
  // Final prompt content ready

  if (
    !assert(
      contentLength <= UILimits.MAX_PROMPT_CONTENT_LENGTH,
      `Prompt content exceeds maximum allowed length of ${UILimits.MAX_PROMPT_CONTENT_LENGTH} characters`,
    )
  ) {
    console.warn(
      `Prompt content truncated from ${contentLength} to ${UILimits.MAX_PROMPT_CONTENT_LENGTH} characters`,
    );
    if (finalPromptElement.textContent) {
      finalPromptElement.textContent = finalPromptElement.textContent.substring(
        0,
        UILimits.MAX_PROMPT_CONTENT_LENGTH,
      );
    }
  }

  // Check if the button has already been initialized
  if ((promptButton as any).hasInitialized) {
    // Prompt button already initialized
    return false;
  }

  // Set initial state - ensure it's hidden initially
  finalPromptElement.style.display = "none";
  // Set initial display style for final prompt

  // Mark the button as initialized
  (promptButton as any).hasInitialized = true;
  // Prompt button initialized

  // Add the click event listener using the safe function
  const listenerAdded = addEventListenerSafe(promptButton, "click", () => {
    // Prompt button clicked

    // Get the current display style
    const currentDisplay = finalPromptElement.style.display;
    // Toggle display visibility

    // Toggle display property
    const isVisible = currentDisplay === "none" || currentDisplay === "";
    const newDisplay = isVisible ? "flex" : "none";
    finalPromptElement.style.display = newDisplay;
    // Display style updated

    // Update button text based on visibility state
    const buttonTextElement = document.getElementById("prompt-button-text");
    if (buttonTextElement) {
      buttonTextElement.textContent = isVisible ? "Dölj prompt" : "Visa prompt";
      // Button text updated
    }

    // Rotate the arrow icon
    const arrowIcon = promptButton.querySelector("svg");
    if (arrowIcon) {
      arrowIcon.style.transform = isVisible ? "rotate(180deg)" : "rotate(0)";
      // Arrow rotation updated
    }
  });

  // Prompt button setup complete
  return listenerAdded;
};

/**
 * Initializes an update info button that toggles visibility of update information
 * @returns Whether initialization was successful
 */
export const initializeUpdateInfoButton = (): boolean => {
  // Initializing update info button
  const updateButton = querySelectorSafe(".update-button") as HTMLButtonElement;
  const updateInfo = document.getElementById("update-info");

  if (!updateButton || !updateInfo) {
    console.warn("Update button or update info element not found");
    return false;
  }

  // Check if the button has already been initialized
  if ((updateButton as any).hasInitialized) {
    // Update info button already initialized
    return false;
  }

  // Mark the button as initialized
  (updateButton as any).hasInitialized = true;
  // Update info button initialized

  // Track visibility state
  let isVisible = false;

  // Add the click event listener using the safe function
  const listenerAdded = addEventListenerSafe(updateButton, "click", () => {
    // Update info button clicked
    isVisible = !isVisible;
    updateInfo.style.display = isVisible ? "block" : "none";

    // Rotate the arrow icon
    const arrowIcon = updateButton.querySelector("svg");
    if (arrowIcon) {
      arrowIcon.style.transform = isVisible ? "rotate(180deg)" : "rotate(0)";
    }
  });

  // Update info button setup complete
  return listenerAdded;
};

/**
 * Validates initialization parameters for the summarize button
 * @param textInputId - ID of the text input element
 * @param summaryOutputId - ID of the summary output element
 * @param summarizeButtonId - ID of the summarize button element
 * @returns True if validation passes
 */
function validateSummarizeButtonParams(
  textInputId: string,
  summaryOutputId: string,
  summarizeButtonId: string,
): boolean {
  assert(
    typeof textInputId === "string" && textInputId.length > 0,
    "Text input ID is required",
  );
  assert(
    typeof summaryOutputId === "string" && summaryOutputId.length > 0,
    "Summary output ID is required",
  );
  assert(
    typeof summarizeButtonId === "string" && summarizeButtonId.length > 0,
    "Summarize button ID is required",
  );
  return true;
}

/**
 * Gets and validates DOM elements for summarize button
 * @param textInputId - ID of the text input element
 * @param summaryOutputId - ID of the summary output element
 * @param summarizeButtonId - ID of the summarize button element
 * @returns Object with DOM elements or null if validation fails
 */
function getSummarizeDOMElements(
  textInputId: string,
  summaryOutputId: string,
  summarizeButtonId: string,
): {
  textInput: HTMLTextAreaElement;
  summaryOutput: HTMLTextAreaElement;
  summarizeButton: HTMLButtonElement;
} | null {
  const textInput = document.getElementById(textInputId) as HTMLTextAreaElement;
  const summaryOutput = document.getElementById(
    summaryOutputId,
  ) as HTMLTextAreaElement;
  const summarizeButton = document.getElementById(
    summarizeButtonId,
  ) as HTMLButtonElement;

  if (!textInput || !summaryOutput || !summarizeButton) {
    console.error("Required DOM elements not found");
    return null;
  }

  return { textInput, summaryOutput, summarizeButton };
}

/**
 * Processes text content including attached files
 * @param textInput - Text input element
 * @param clickCount - Current click count
 * @param processAttachedFiles - Optional function to process attached files
 * @returns Processed text content
 */
async function processTextContent(
  textInput: HTMLTextAreaElement,
  clickCount: number,
  processAttachedFiles?: (text: string, clickCount: number) => Promise<string>,
): Promise<string> {
  let allText = textInput.value.trim();
  console.log(
    `[SummarizeButton] Initial textarea content length: ${allText.length}`,
  );
  console.log(
    `[SummarizeButton] Textarea first 100 chars: ${allText.substring(0, 100)}...`,
  );

  if (typeof processAttachedFiles === "function") {
    console.log(
      `[SummarizeButton] processAttachedFiles function is available, calling it...`,
    );
    allText = await processAttachedFiles(allText, clickCount);
    console.log(
      `[SummarizeButton] After processAttachedFiles, text length: ${allText.length}`,
    );
  } else {
    console.log(`[SummarizeButton] No processAttachedFiles function available`);
  }

  assert(allText !== undefined, "Text content is undefined");
  console.log(
    `[SummarizeButton] Final text check - Length: ${allText.length}, Is empty: ${!allText}`,
  );

  return allText;
}

/**
 * Handles the case when no text is available
 * @param clickCount - Current click count
 */
function handleNoTextError(clickCount: number): void {
  console.warn(
    "[SummarizeButton] No text to process - allText is empty or falsy",
  );

  textProcessingEvents.emit(TextProcessingEventType.PROCESSING_ERROR, {
    clickCount,
    attemptNumber: 1,
    timestamp: Date.now(),
    error: new Error("No text provided"),
    errorMessage: "Du måste skriva eller lägga till text att bearbeta.",
  });
}

/**
 * Handles summarization errors
 * @param error - The error that occurred
 * @param clickCount - Current click count
 */
function handleSummarizationError(error: Error, clickCount: number): void {
  console.error(`Error in summarization process (${clickCount}):`, error);

  textProcessingEvents.emit(TextProcessingEventType.PROCESSING_ERROR, {
    clickCount,
    attemptNumber: 1,
    timestamp: Date.now(),
    error: error as Error,
    errorMessage: "Ett fel uppstod vid bearbetningen. Försök igen senare.",
  });
}

/**
 * Initializes the summarize button with event handling
 * @param textInputId - ID of the text input element
 * @param summaryOutputId - ID of the summary output element
 * @param summarizeButtonId - ID of the summarize button element
 * @param processAttachedFiles - Optional function to process attached files
 * @returns Whether initialization was successful
 */
export function initializeSummarizeButton(
  textInputId: string,
  summaryOutputId: string,
  summarizeButtonId: string,
  processAttachedFiles?: (text: string, clickCount: number) => Promise<string>,
): boolean {
  // Validate parameters
  if (
    !validateSummarizeButtonParams(
      textInputId,
      summaryOutputId,
      summarizeButtonId,
    )
  ) {
    return false;
  }

  // Get DOM elements
  const elements = getSummarizeDOMElements(
    textInputId,
    summaryOutputId,
    summarizeButtonId,
  );
  if (!elements) {
    return false;
  }

  const { textInput, summaryOutput, summarizeButton } = elements;

  // Initialize state
  let summarizeClickCount = 0;
  let isSummarizing = false;

  // Add event listener to summarize button
  summarizeButton.addEventListener("click", async () => {
    summarizeClickCount++;
    console.log(`Processing request #${summarizeClickCount}`);

    // Check if already processing or in cooldown
    if (isSummarizing || (window as any).isButtonInCooldown?.()) {
      return;
    }

    isSummarizing = true;
    updateButtonState(summarizeButton, true);

    // Emit processing started event
    textProcessingEvents.emit<TextProcessingEventData>(
      TextProcessingEventType.PROCESSING_STARTED,
      {
        clickCount: summarizeClickCount,
        attemptNumber: 1,
        timestamp: Date.now(),
      },
    );

    try {
      console.log(
        `[SummarizeButton] ========== SUMMARIZE BUTTON CLICKED ==========`,
      );
      console.log(`[SummarizeButton] Click count: ${summarizeClickCount}`);

      // Create abort controller for this request
      const abortController = createAbortController();
      console.log(
        `[SummarizeButton] Created AbortController for request #${summarizeClickCount}`,
      );

      const allText = await processTextContent(
        textInput,
        summarizeClickCount,
        processAttachedFiles,
      );

      if (allText) {
        console.log(
          `[SummarizeButton] Text available, proceeding with summarization`,
        );
        console.log(
          `[SummarizeButton] Text length: ${allText.length} characters`,
        );

        // Pass abort signal to processing
        await processSummaryWithQuality(
          allText,
          summaryOutput,
          summarizeClickCount,
          1,
          undefined,
          abortController.signal,
        );
        console.log(`✅ [SummarizeButton] Processing completed successfully`);

        // Clear abort controller after successful completion
        clearAbortController();
        console.log(
          `[SummarizeButton] Cleared AbortController after successful completion`,
        );
      } else {
        handleNoTextError(summarizeClickCount);
        clearAbortController();
      }
    } catch (error) {
      // Check if this was a cancellation
      const errorMessage = (error as Error).message;
      if (errorMessage && errorMessage.includes("cancelled")) {
        console.log(`[SummarizeButton] 🛑 Request was cancelled by user`);
        textProcessingEvents.emit<ProcessingErrorEventData>(
          TextProcessingEventType.PROCESSING_ERROR,
          {
            clickCount: summarizeClickCount,
            attemptNumber: 1,
            timestamp: Date.now(),
            error: error as Error,
            errorMessage: "Bearbetningen avbröts",
          },
        );
      } else {
        handleSummarizationError(error as Error, summarizeClickCount);
      }
      clearAbortController();
    } finally {
      isSummarizing = false;
    }
  });

  return true;
}

/**
 * Initialize the cancel request button
 * Allows users to cancel ongoing AI requests
 * @param cancelButtonId - The ID of the cancel button
 * @returns true if initialization was successful, false otherwise
 */
export function initializeCancelButton(cancelButtonId: string): boolean {
  console.log(
    `[CancelButton] Initializing cancel button with ID: ${cancelButtonId}`,
  );

  // Validate parameter
  if (!cancelButtonId || typeof cancelButtonId !== "string") {
    console.error("[CancelButton] Invalid cancelButtonId provided");
    return false;
  }

  // Get cancel button element
  const cancelButton = document.getElementById(
    cancelButtonId,
  ) as HTMLButtonElement;
  if (!cancelButton) {
    console.error(
      `[CancelButton] Cancel button not found with ID: ${cancelButtonId}`,
    );
    return false;
  }

  console.log(`[CancelButton] Cancel button found, adding event listener`);

  // Add click event listener
  cancelButton.addEventListener("click", () => {
    console.log("[CancelButton] Cancel button clicked by user");

    // Import cancelCurrentRequest dynamically to avoid circular dependency
    import("../../core/app-state.js").then(({ cancelCurrentRequest }) => {
      const wasCancelled = cancelCurrentRequest();

      if (wasCancelled) {
        console.log(
          "[CancelButton] Successfully cancelled the current request",
        );
        // Optionally show user feedback
        const originalText = cancelButton.textContent;
        cancelButton.textContent = "Avbruten";
        setTimeout(() => {
          if (originalText) {
            cancelButton.textContent = originalText;
          }
        }, 2000);
      } else {
        console.log("[CancelButton] No active request to cancel");
      }
    });
  });

  console.log("[CancelButton] Cancel button initialized successfully");
  return true;
}
