/**
 * Text Processing Events Module
 * Handles event emission and listening for text processing workflow
 * Separates business logic from UI concerns
 *
 * @module text-processing-events
 */

/**
 * Text processing event types
 */
export enum TextProcessingEventType {
  PROCESSING_STARTED = "processing-started",
  TEXT_SUBMITTED = "text-submitted",
  TEXT_RECEIVED_FROM_DATABASE = "text-received-from-database",
  QUALITY_EVALUATION_STARTED = "quality-evaluation-started",
  QUALITY_EVALUATION_COMPLETED = "quality-evaluation-completed",
  PROCESSING_COMPLETED = "processing-completed",
  PROCESSING_ERROR = "processing-error",
}

/**
 * Event data interfaces
 */
export interface TextProcessingEventData {
  clickCount: number;
  attemptNumber?: number;
  timestamp: number;
}

export interface TextSubmittedEventData extends TextProcessingEventData {
  textLength: number;
}

export interface TextReceivedEventData extends TextProcessingEventData {
  text: string;
  qualityEvaluationId?: number;
  hasQualityProcess: boolean;
  systemMessage?: string;
  isFinalAttempt?: boolean;
}

export interface QualityEvaluationEventData extends TextProcessingEventData {
  qualityEvaluationId: number;
  score?: number;
  needsResubmission?: boolean;
}

export interface ProcessingCompletedEventData extends TextProcessingEventData {
  finalScore?: number;
  totalAttempts: number;
}

export interface ProcessingErrorEventData extends TextProcessingEventData {
  error: Error;
  errorMessage: string;
}

/**
 * Event listener type
 */
export type TextProcessingEventListener<T = any> = (data: T) => void;

/**
 * Text Processing Event Emitter
 * Manages event subscription and emission for text processing workflow
 */
class TextProcessingEventEmitter {
  private listeners: Map<
    TextProcessingEventType,
    TextProcessingEventListener[]
  >;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to a text processing event
   * @param eventType - The event type to listen for
   * @param listener - The callback function to execute when event is emitted
   */
  on<T>(
    eventType: TextProcessingEventType,
    listener: TextProcessingEventListener<T>,
  ): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
    // Event listener registered
  }

  /**
   * Unsubscribe from a text processing event
   * @param eventType - The event type to unsubscribe from
   * @param listener - The callback function to remove
   */
  off<T>(
    eventType: TextProcessingEventType,
    listener: TextProcessingEventListener<T>,
  ): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
        // Event listener removed
      }
    }
  }

  /**
   * Emit a text processing event
   * @param eventType - The event type to emit
   * @param data - The event data to pass to listeners
   */
  emit<T>(eventType: TextProcessingEventType, data: T): void {
    // Event emitted
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[Events] Error in listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for all events
   */
  removeAllListeners(): void {
    this.listeners.clear();
    // All listeners removed
  }
}

// Create singleton instance
export const textProcessingEvents = new TextProcessingEventEmitter();

/**
 * Initialize UI event listeners
 * Sets up UI components to respond to text processing events
 */
export function initializeUIEventListeners(): void {
  // Initializing UI event listeners

  // Listen for processing started event
  textProcessingEvents.on<TextProcessingEventData>(
    TextProcessingEventType.PROCESSING_STARTED,
    async (data) => {
      console.log(`Processing started (attempt ${data.clickCount})`);

      // Show loading indicator in output area
      const { showOutputLoadingIndicator } = await import(
        "../../ui/components/output-status.js"
      );
      showOutputLoadingIndicator();

      // Clear the summary output
      const summaryOutput = document.getElementById(
        "summary-output",
      ) as HTMLTextAreaElement;
      if (summaryOutput) {
        summaryOutput.value = "";
        summaryOutput.dispatchEvent(new Event("input"));
      }
    },
  );

  // Listen for text received from database event
  textProcessingEvents.on<TextReceivedEventData>(
    TextProcessingEventType.TEXT_RECEIVED_FROM_DATABASE,
    async (data) => {
      console.log(`Text processed (attempt ${data.clickCount})`);

      // Set the processed text in the textarea
      const summaryOutput = document.getElementById(
        "summary-output",
      ) as HTMLTextAreaElement;
      if (summaryOutput) {
        // Line separator validation omitted for cleaner logging

        // Set the text value directly - textareas should preserve Unicode line separators
        summaryOutput.value = data.text;
        summaryOutput.dispatchEvent(new Event("input"));

        // Line separator validation omitted for cleaner logging

        // Sample text analysis omitted for cleaner logging
      }

      // Update prompt output if available
      const promptOutput = document.getElementById(
        "prompt-output",
      ) as HTMLTextAreaElement;
      if (promptOutput && data.systemMessage) {
        promptOutput.value = data.systemMessage.trim();
        promptOutput.dispatchEvent(new Event("input"));
      }

      // If no quality process, show success indicator immediately
      if (!data.hasQualityProcess) {
        const { showOutputSuccessIndicator } = await import(
          "../../ui/components/output-status.js"
        );
        showOutputSuccessIndicator(2000);
      }
    },
  );

  // Listen for processing completed event
  textProcessingEvents.on<ProcessingCompletedEventData>(
    TextProcessingEventType.PROCESSING_COMPLETED,
    async (data) => {
      console.log(`Processing completed (attempt ${data.clickCount})`);

      // Show success indicator
      const { showOutputSuccessIndicator } = await import(
        "../../ui/components/output-status.js"
      );
      showOutputSuccessIndicator(2000);
    },
  );

  // Listen for processing error event
  textProcessingEvents.on<ProcessingErrorEventData>(
    TextProcessingEventType.PROCESSING_ERROR,
    async (data) => {
      console.error(
        `Processing failed (attempt ${data.clickCount}):`,
        data.error,
      );

      // Show error indicator
      const { showOutputErrorIndicator } = await import(
        "../../ui/components/output-status.js"
      );
      showOutputErrorIndicator(data.errorMessage, 5000);
    },
  );

  // UI event listeners initialized
}

/**
 * Initialize button event listeners
 * Sets up button states to respond to text processing events
 */
export function initializeButtonEventListeners(): void {
  // Initializing button event listeners

  let isInCooldown = false;
  const COOLDOWN_DURATION = 1000; // 1 second cooldown

  // Listen for processing completed event to trigger button cooldown
  // This ensures button stays in loading state during quality resubmissions
  textProcessingEvents.on<ProcessingCompletedEventData>(
    TextProcessingEventType.PROCESSING_COMPLETED,
    async () => {
      // Button cooldown started

      const summarizeButton = document.getElementById(
        "summarize-button",
      ) as HTMLButtonElement;
      if (!summarizeButton) return;

      // Set cooldown flag
      isInCooldown = true;

      // Add cooldown animation class
      summarizeButton.classList.add("cooldown-animation");

      // Import button state function
      const { updateButtonState } = await import(
        "../../ui/components/button-state.js"
      );

      // Keep button in loading state during cooldown
      setTimeout(() => {
        isInCooldown = false;
        updateButtonState(summarizeButton, false);
        // Remove cooldown animation class when cooldown completes
        summarizeButton.classList.remove("cooldown-animation");
        // Button cooldown completed
      }, COOLDOWN_DURATION);
    },
  );

  // Listen for processing error to reset button state
  textProcessingEvents.on<ProcessingErrorEventData>(
    TextProcessingEventType.PROCESSING_ERROR,
    async () => {
      // Button state reset after error

      const summarizeButton = document.getElementById(
        "summarize-button",
      ) as HTMLButtonElement;
      if (!summarizeButton) return;

      // Import button state function
      const { updateButtonState } = await import(
        "../../ui/components/button-state.js"
      );
      updateButtonState(summarizeButton, false);
      summarizeButton.classList.remove("cooldown-animation");
      isInCooldown = false;
    },
  );

  // Export cooldown state checker
  (window as any).isButtonInCooldown = () => isInCooldown;

  // Button event listeners initialized
}
