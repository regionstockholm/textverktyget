/**
 * Output Status Indicators Module
 * Handles loading and success states for the output area
 */

import { assert } from "../../safety/assertions.js";
import { safetyConfig } from "../../../config/shared-config.js";
import {
  ProcessingState,
  formatStageStatusMessage,
  formatStatusMessage,
  getDefaultStatusMessage,
} from "../constants/status-messages.js";

// Add logging to track when this module is loaded

/**
 * Output status states
 */
export enum OutputStatus {
  HIDDEN = "hidden",
  LOADING = "loading",
  SUCCESS = "success",
  ERROR = "error",
}

/**
 * Interface for status indicator elements
 */
interface StatusElements {
  container: HTMLElement | null;
  loadingIndicator: HTMLElement | null;
  successIndicator: HTMLElement | null;
  errorIndicator: HTMLElement | null;
}

// Track the active hide timeout to prevent multiple conflicting timeouts
let activeHideTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Gets the status indicator elements
 * @returns The status elements object
 */
function getStatusElements(): StatusElements {
  return {
    container: document.getElementById("output-status-indicators"),
    loadingIndicator: document.getElementById("output-loading-indicator"),
    successIndicator: document.getElementById("output-success-indicator"),
    errorIndicator: document.getElementById("output-error-indicator"),
  };
}

/**
 * Updates the loading indicator text with attempt information
 * @param state - Current processing state (processing or quality evaluation)
 * @param attemptNumber - Current attempt number (optional)
 * @param maxAttempts - Maximum number of attempts (optional)
 */
function updateLoadingText(
  state: ProcessingState,
  attemptNumber?: number,
  maxAttempts?: number,
  stageMessage?: string,
): void {
  const loadingIndicator = document.getElementById("output-loading-indicator");
  if (!loadingIndicator) {
    console.warn("Loading indicator not found");
    return;
  }

  const statusTextElement = loadingIndicator.querySelector(".status-text");
  if (!statusTextElement) {
    console.warn("Status text element not found");
    return;
  }

  if (stageMessage && attemptNumber && maxAttempts) {
    statusTextElement.textContent = formatStageStatusMessage(
      stageMessage,
      attemptNumber,
      maxAttempts,
    );
  } else if (attemptNumber && maxAttempts) {
    // If we have attempt information, format message with state
    statusTextElement.textContent = formatStatusMessage(
      state,
      attemptNumber,
      maxAttempts,
    );
  } else {
    // Fallback to default text
    statusTextElement.textContent = getDefaultStatusMessage();
  }
}

/**
 * Shows the loading indicator in the output area
 * @param state - Current processing state (default: PROCESSING)
 * @param attemptNumber - Current attempt number (optional)
 * @param maxAttempts - Maximum number of attempts (optional)
 * @returns Whether the operation was successful
 */
export function showOutputLoadingIndicator(
  state: ProcessingState = ProcessingState.PROCESSING,
  attemptNumber?: number,
  maxAttempts?: number,
  stageMessage?: string,
): boolean {
  console.log(
    `Showing ${state} indicator (attempt ${attemptNumber || 1}/${maxAttempts || "?"})`,
  );

  try {
    const elements = getStatusElements();

    // Assert preconditions
    assert(
      elements.container !== null,
      "Status indicators container not found",
    );
    assert(
      elements.loadingIndicator !== null,
      "Loading indicator element not found",
    );
    assert(
      elements.successIndicator !== null,
      "Success indicator element not found",
    );
    assert(
      elements.errorIndicator !== null,
      "Error indicator element not found",
    );

    if (
      !elements.container ||
      !elements.loadingIndicator ||
      !elements.successIndicator ||
      !elements.errorIndicator
    ) {
      console.error("Required status indicator elements not found");
      return false;
    }

    // Hide other indicators and show loading indicator
    elements.successIndicator.classList.remove("active");
    elements.errorIndicator.classList.remove("active");
    elements.loadingIndicator.classList.add("active");

    // Update the loading text with state and attempt information
    updateLoadingText(state, attemptNumber, maxAttempts, stageMessage);

    console.log("Output loading indicator shown successfully");
    return true;
  } catch (error) {
    console.error("Error showing output loading indicator:", error);
    return false;
  }
}

/**
 * Shows the success indicator in the output area
 * @param duration - How long to show the success indicator in milliseconds
 * @returns Whether the operation was successful
 */
export function showOutputSuccessIndicator(duration: number = 2000): boolean {
  console.log(`Showing output success indicator for ${duration}ms`);

  try {
    // Assert preconditions
    assert(
      typeof duration === "number" && duration > 0,
      "Duration must be a positive number",
    );
    assert(
      duration <= safetyConfig.MAX_TIMEOUT_DURATION,
      "Duration exceeds maximum allowed timeout",
    );

    const elements = getStatusElements();

    assert(
      elements.container !== null,
      "Status indicators container not found",
    );
    assert(
      elements.loadingIndicator !== null,
      "Loading indicator element not found",
    );
    assert(
      elements.successIndicator !== null,
      "Success indicator element not found",
    );
    assert(
      elements.errorIndicator !== null,
      "Error indicator element not found",
    );

    if (
      !elements.container ||
      !elements.loadingIndicator ||
      !elements.successIndicator ||
      !elements.errorIndicator
    ) {
      console.error("Required status indicator elements not found");
      return false;
    }

    // Clear any existing hide timeout to prevent blink effect
    if (activeHideTimeout !== null) {
      clearTimeout(activeHideTimeout);
      activeHideTimeout = null;
      console.log("Cleared existing hide timeout to prevent blink effect");
    }

    // Show success indicator first, then hide other indicators
    // This prevents any brief moment where no overlay is visible
    elements.successIndicator.classList.add("active");
    elements.loadingIndicator.classList.remove("active");
    elements.errorIndicator.classList.remove("active");

    // Auto-hide after specified duration
    activeHideTimeout = setTimeout(() => {
      hideOutputStatusIndicators();
      activeHideTimeout = null;
    }, duration);

    console.log("Output success indicator shown successfully");
    return true;
  } catch (error) {
    console.error("Error showing output success indicator:", error);
    return false;
  }
}

/**
 * Shows the error indicator in the output area
 * @param message - Optional custom error message to display
 * @param duration - How long to show the error indicator in milliseconds
 * @returns Whether the operation was successful
 */
export function showOutputErrorIndicator(
  message: string = "Något gick fel, försök igen.",
  duration: number = 5000,
): boolean {
  console.log(`Showing output error indicator for ${duration}ms: ${message}`);

  try {
    // Assert preconditions
    assert(typeof message === "string", "Message must be a string");
    assert(
      typeof duration === "number" && duration > 0,
      "Duration must be a positive number",
    );
    assert(
      duration <= safetyConfig.MAX_TIMEOUT_DURATION,
      "Duration exceeds maximum allowed timeout",
    );

    const elements = getStatusElements();

    assert(
      elements.container !== null,
      "Status indicators container not found",
    );
    assert(
      elements.loadingIndicator !== null,
      "Loading indicator element not found",
    );
    assert(
      elements.successIndicator !== null,
      "Success indicator element not found",
    );
    assert(
      elements.errorIndicator !== null,
      "Error indicator element not found",
    );

    if (
      !elements.container ||
      !elements.loadingIndicator ||
      !elements.successIndicator ||
      !elements.errorIndicator
    ) {
      console.error("Required status indicator elements not found");
      return false;
    }

    // Clear any existing hide timeout to prevent conflicts
    if (activeHideTimeout !== null) {
      clearTimeout(activeHideTimeout);
      activeHideTimeout = null;
      console.log("Cleared existing hide timeout for error indicator");
    }

    // Update error message if provided
    const errorTextElement =
      elements.errorIndicator.querySelector(".status-text");
    if (errorTextElement && message) {
      errorTextElement.textContent = message;
    }

    // Show error indicator and hide other indicators
    elements.errorIndicator.classList.add("active");
    elements.loadingIndicator.classList.remove("active");
    elements.successIndicator.classList.remove("active");

    // Auto-hide after specified duration
    activeHideTimeout = setTimeout(() => {
      hideOutputStatusIndicators();
      activeHideTimeout = null;
    }, duration);

    console.log("Output error indicator shown successfully");
    return true;
  } catch (error) {
    console.error("Error showing output error indicator:", error);
    return false;
  }
}

/**
 * Hides all output status indicators
 * @returns Whether the operation was successful
 */
export function hideOutputStatusIndicators(): boolean {
  console.log("Hiding all output status indicators");

  try {
    // Clear any active hide timeout since we're hiding manually
    if (activeHideTimeout !== null) {
      clearTimeout(activeHideTimeout);
      activeHideTimeout = null;
      console.log("Cleared active hide timeout during manual hide");
    }

    const elements = getStatusElements();

    // Assert preconditions
    assert(
      elements.container !== null,
      "Status indicators container not found",
    );
    assert(
      elements.loadingIndicator !== null,
      "Loading indicator element not found",
    );
    assert(
      elements.successIndicator !== null,
      "Success indicator element not found",
    );
    assert(
      elements.errorIndicator !== null,
      "Error indicator element not found",
    );

    if (
      !elements.container ||
      !elements.loadingIndicator ||
      !elements.successIndicator ||
      !elements.errorIndicator
    ) {
      console.error("Required status indicator elements not found");
      return false;
    }

    // Hide all indicators
    elements.loadingIndicator.classList.remove("active");
    elements.successIndicator.classList.remove("active");
    elements.errorIndicator.classList.remove("active");

    console.log("All output status indicators hidden successfully");
    return true;
  } catch (error) {
    console.error("Error hiding output status indicators:", error);
    return false;
  }
}

/**
 * Sets the output status
 * @param status - The status to set
 * @param duration - Duration for success/error indicator (only used for SUCCESS/ERROR status)
 * @param message - Custom message for error status (only used for ERROR status)
 * @returns Whether the operation was successful
 */
export function setOutputStatus(
  status: OutputStatus,
  duration?: number,
  message?: string,
): boolean {
  // Assert preconditions
  assert(
    Object.values(OutputStatus).includes(status),
    "Invalid status provided",
  );

  console.log(`Setting output status to: ${status}`);

  try {
    switch (status) {
      case OutputStatus.HIDDEN:
        return hideOutputStatusIndicators();

      case OutputStatus.LOADING:
        return showOutputLoadingIndicator();

      case OutputStatus.SUCCESS:
        return showOutputSuccessIndicator(duration);

      case OutputStatus.ERROR:
        return showOutputErrorIndicator(message, duration);

      default:
        console.error(`Unknown status: ${status}`);
        return false;
    }
  } catch (error) {
    console.error(`Error setting output status to ${status}:`, error);
    return false;
  }
}
