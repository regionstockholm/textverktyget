/**
 * Summarizer UI Module
 * Handles the initialization and management of the summarizer interface components
 * @module summarizer-ui
 */

import { initializeTextCounters } from "./components/counter.js";
import {
  initializeCopyButton,
  initializePromptButton,
  initializeUpdateInfoButton,
} from "./components/button-initializers.js";
import { getElementByIdSafe } from "./utils/dom.js";
import { assert } from "../safety/assertions.js";

/**
 * Interface for DOM elements used by the summarizer
 */
interface SummarizerElements {
  textInput: HTMLTextAreaElement | null;
  summaryOutput: HTMLTextAreaElement | null;
  promptOutput: HTMLElement | null;
  copyButton: HTMLButtonElement | null;
  promptButton: HTMLButtonElement | null;
  targetAudienceDropdown: HTMLSelectElement | null;
  charCountInput: HTMLElement | null;
  charCountOutput: HTMLElement | null;
  lixCountInput: HTMLElement | null;
  lixCountOutput: HTMLElement | null;
  finalPrompt: HTMLElement | null;
}

/**
 * Gets all required elements for the summarizer UI
 * @returns The elements object with all required DOM elements
 */
const getSummarizerElements = (): SummarizerElements => {
  return {
    textInput: getElementByIdSafe("text-input") as HTMLTextAreaElement,
    summaryOutput: getElementByIdSafe("summary-output") as HTMLTextAreaElement,
    promptOutput: getElementByIdSafe("prompt-output") as HTMLElement,
    copyButton: getElementByIdSafe("copy-text") as HTMLButtonElement,
    promptButton: getElementByIdSafe("prompt-button") as HTMLButtonElement,
    targetAudienceDropdown: getElementByIdSafe(
      "target-audience",
    ) as HTMLSelectElement,
    charCountInput: getElementByIdSafe("char-count-input") as HTMLElement,
    charCountOutput: getElementByIdSafe("char-count-output") as HTMLElement,
    lixCountInput: getElementByIdSafe("lix-count-input") as HTMLElement,
    lixCountOutput: getElementByIdSafe("lix-count-output") as HTMLElement,
    finalPrompt: getElementByIdSafe("final-prompt") as HTMLElement,
  };
};

/**
 * Initialize the counter components
 * @param elements - The summarizer UI elements
 * @returns Whether initialization was successful
 */
const initializeCounters = (elements: SummarizerElements): boolean => {
  let success = true;

  // Initialize input text counters
  if (elements.textInput && elements.charCountInput && elements.lixCountInput) {
    const inputCountersInitialized = initializeTextCounters(
      elements.textInput,
      "char-count-input",
      "lix-count-input",
    );

    if (!inputCountersInitialized) {
      console.warn("Failed to initialize input text counters");
      success = false;
    }
  } else {
    console.warn("Input text counter elements not found");
    success = false;
  }

  // Initialize output text counters
  if (
    elements.summaryOutput &&
    elements.charCountOutput &&
    elements.lixCountOutput
  ) {
    const outputCountersInitialized = initializeTextCounters(
      elements.summaryOutput,
      "char-count-output",
      "lix-count-output",
    );

    if (!outputCountersInitialized) {
      console.warn("Failed to initialize output text counters");
      success = false;
    }
  } else {
    console.warn("Output text counter elements not found");
    success = false;
  }

  return success;
};

/**
 * Initialize the button components
 * @param elements - The summarizer UI elements
 * @returns Whether initialization was successful
 */
const initializeButtons = (elements: SummarizerElements): boolean => {
  let success = true;

  // Initialize copy button
  if (elements.copyButton && elements.summaryOutput) {
    const copyInitialized = initializeCopyButton(
      elements.copyButton,
      () =>
        elements.summaryOutput?.value ||
        elements.summaryOutput?.textContent ||
        "",
    );

    if (!copyInitialized) {
      console.warn("Failed to initialize copy button");
      success = false;
    }
  } else {
    console.warn("Copy button or summary output element not found");
    success = false;
  }

  // Initialize prompt button
  if (elements.promptButton && elements.finalPrompt) {
    const promptInitialized = initializePromptButton(
      elements.promptButton,
      elements.finalPrompt,
    );

    if (!promptInitialized) {
      console.warn("Failed to initialize prompt button");
      success = false;
    }
  } else {
    console.warn("Prompt button or final prompt element not found");
    success = false;
  }

  // Initialize update info button
  const updateInfoInitialized = initializeUpdateInfoButton();
  if (!updateInfoInitialized) {
    console.warn("Failed to initialize update info button");
    success = false;
  }

  return success;
};

/**
 * Initializes all UI components for the summarizer
 * Sets up event listeners, counters, and button handlers
 *
 * @function
 * @example
 * // Initialize all summarizer UI components
 * initializeSummarizer();
 */
export const initializeSummarizer = (): void => {
  try {
    // Get all required elements
    const elements = getSummarizerElements();

    // UI elements validation (debug info omitted)

    // Validate critical elements
    assert(!!elements.textInput, "Text input element not found");
    assert(!!elements.summaryOutput, "Summary output element not found");

    // Initialize components
    const countersInitialized = initializeCounters(elements);
    const buttonsInitialized = initializeButtons(elements);

    // Log initialization status
    if (countersInitialized && buttonsInitialized) {
      console.log("Summarizer UI components initialized successfully");
    } else {
      console.warn("Some summarizer UI components failed to initialize");
    }
  } catch (error) {
    // Add comprehensive error handling
    console.error("Failed to initialize summarizer UI:", error);
  }
};
