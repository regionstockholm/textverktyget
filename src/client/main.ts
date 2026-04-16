/**
 * Main Application Entry Point
 * Initializes all client-side functionality without authentication
 */

// Import necessary modules
import { initializeSummarizer } from "./ui/summarizer-ui.js";
import { initializeFileUpload } from "./file/file-upload-controller.js";
import { initializeWwwFetcherModal } from "./ui/components/www-fetcher-modal.js";
import { initializeWordModal } from "./ui/components/word-modal.js";
import { initializeTextQualityEvaluation } from "./core/quality/quality-evaluation-client.js";
import {
  initializeUIEventListeners,
  initializeButtonEventListeners,
} from "./core/events/text-processing-events.js";
import {
  initializeTaskCatalog,
  initializeTargetAudienceCatalog,
} from "./core/summarizer/task-catalog.js";
import {
  initializeSummarizeButton,
  initializeWordModalButton,
  initializeCancelButton,
} from "./ui/components/button-initializers.js";
import { processAttachedFiles } from "./core/app-state.js";
import { attachedFiles } from "./file/file-upload-controller.js";
import { processFile } from "./file/core/file-processor.js";

// Application starting...

/**
 * Initialize all application components
 */
function initializeApplication(): void {
  try {
    initializeTaskCatalog().catch((error) => {
      console.warn("Task catalog initialization failed", error);
    });
    initializeTargetAudienceCatalog().catch((error) => {
      console.warn("Target audience catalog initialization failed", error);
    });

    // Initialize text processing event listeners
    initializeUIEventListeners();
    initializeButtonEventListeners();

    // Initialize summarizer UI components
    initializeSummarizer();

    // Initialize file upload functionality
    initializeFileUpload();

    // Initialize modals
    initializeWwwFetcherModal();
    initializeWordModal();

    // Initialize text quality evaluation
    initializeTextQualityEvaluation();

    // Initialize the main summarize button

    // Create a wrapper function that matches the expected signature
    const processAttachedFilesWrapper = async (
      text: string,
      clickCount: number,
    ): Promise<string> => {
      return await processAttachedFiles(
        text,
        clickCount,
        attachedFiles,
        processFile,
      );
    };

    const summarizeButtonInitialized = initializeSummarizeButton(
      "text-input",
      "summary-output",
      "summarize-button",
      processAttachedFilesWrapper,
    );

    if (!summarizeButtonInitialized) {
      console.error("Failed to initialize summarize button");
    }

    // Initialize the cancel button
    const cancelButtonInitialized = initializeCancelButton("cancel-request");
    if (!cancelButtonInitialized) {
      console.error("Failed to initialize cancel button");
    }

    // Initialize the Word modal button (copy-text-word)
    const copyTextWordButton = document.getElementById(
      "copy-text-word",
    ) as HTMLButtonElement;
    if (copyTextWordButton) {
      const wordModalButtonInitialized = initializeWordModalButton(
        copyTextWordButton,
        () => {
          // Get the text from the summary output area
          const summaryOutput = document.getElementById(
            "summary-output",
          ) as HTMLTextAreaElement;
          return summaryOutput?.value || summaryOutput?.textContent || "";
        },
      );

      if (!wordModalButtonInitialized) {
        console.error("Failed to initialize Word modal button");
      }
    } else {
      console.error("Word modal button (copy-text-word) not found");
    }

    console.log("Application initialized");
  } catch (error) {
    console.error("Application initialization failed:", error);
  }
}

/**
 * Initialize the application when DOM is ready
 */
function initialize(): void {
  if (document.readyState === "loading") {
    // Setting up DOMContentLoaded event listener
    document.addEventListener("DOMContentLoaded", () => {
      // DOM content loaded, initializing app module
      initializeApplication();
    });
  } else {
    // DOM already loaded, initializing immediately
    initializeApplication();
  }
}

// Start the application
initialize();

// Export for potential external access (without authentication functions)
export { initializeApplication };
