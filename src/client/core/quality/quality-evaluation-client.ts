/**
 * Text Quality Evaluator Module
 * Handles automatic quality evaluation of processed text
 * Follows Power of Ten guidelines for TypeScript
 *
 * @module quality-evaluation
 */

// Text quality evaluation module - event-driven architecture

// Import the updateButtonState function
import { getSummary } from "../summarizer/core.js";
import { FormValues } from "../summarizer/interfaces.js";
import { getSelectedValues } from "../summarizer/processing.js";
import { handleSummarizationError } from "../summarizer/processing.js";
import {
  textProcessingEvents,
  TextProcessingEventType,
  TextReceivedEventData,
  ProcessingCompletedEventData,
  ProcessingErrorEventData,
} from "../events/text-processing-events.js";
import {
  ProcessingState,
  ProcessingStage,
  STAGE_MESSAGES,
} from "../../ui/constants/status-messages.js";

function resolveStageMessage(stage: string, fallback: string): string {
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback;
  }

  const stageValues = Object.values(ProcessingStage) as string[];
  if (stageValues.includes(stage)) {
    return STAGE_MESSAGES[stage as ProcessingStage];
  }

  return STAGE_MESSAGES[ProcessingStage.ANALYSIS];
}

function createClientProcessId(): string {
  return `CLI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function startProgressStream(
  processId: string,
  attemptNumber: number,
  getMaxAttempts: () => number,
  abortSignal?: AbortSignal,
): () => void {
  let stopped = false;
  let progressStream: EventSource | null = null;
  const onAbort = () => {
    if (progressStream) {
      progressStream.close();
      progressStream = null;
    }
    stopped = true;
  };

  if (abortSignal) {
    abortSignal.addEventListener("abort", onAbort, { once: true });
  }

  const handleStageEvent = async (event: MessageEvent<string>): Promise<void> => {
    if (stopped) {
      return;
    }

    let payload: {
      stage?: string;
      message?: string;
      isTerminal?: boolean;
    } | null = null;

    try {
      payload = JSON.parse(event.data) as {
        stage?: string;
        message?: string;
        isTerminal?: boolean;
      };
    } catch {
      return;
    }

    if (!payload) {
      return;
    }

    const stageMessage = resolveStageMessage(
      String(payload.stage || ""),
      typeof payload.message === "string"
        ? payload.message
        : STAGE_MESSAGES[ProcessingStage.ANALYSIS],
    );

    const { showOutputLoadingIndicator } = await import(
      "../../ui/components/output-status.js"
    );
    showOutputLoadingIndicator(
      ProcessingState.PROCESSING,
      attemptNumber,
      getMaxAttempts(),
      stageMessage,
    );

    if (payload.isTerminal) {
      stopped = true;
      if (progressStream) {
        progressStream.close();
        progressStream = null;
      }
      return;
    }
  };

  try {
    progressStream = new EventSource(
      `/api/summarize-progress/stream/${encodeURIComponent(processId)}?ts=${Date.now()}`,
    );
    progressStream.addEventListener("stage", (event) => {
      void handleStageEvent(event as MessageEvent<string>);
    });
    progressStream.onerror = () => {
      if (stopped) {
        return;
      }
      if (progressStream) {
        progressStream.close();
        progressStream = null;
      }
      return;
    };
  } catch {
    // Ignore SSE setup errors and keep default loading text
  }

  return () => {
    stopped = true;
    if (abortSignal) {
      abortSignal.removeEventListener("abort", onAbort);
    }
    if (progressStream) {
      progressStream.close();
      progressStream = null;
    }
  };
}

/**
 * Initializes the text quality evaluation functionality
 * Sets up event listeners for the summary output textarea
 *
 * @returns {boolean} Success status of initialization
 */
export function initializeTextQualityEvaluation(): boolean {
  console.log("[TextQuality] Initializing text quality evaluation...");
  void refreshMaxQualityAttempts();
  // Quality evaluation is now performed on the server side
  return true;
}

/**
 * Default maximum number of quality evaluation attempts
 * This is used as a fallback if backend doesn't provide the value
 */
const DEFAULT_MAX_QUALITY_ATTEMPTS = 5;

/**
 * Stores the current max attempts value from backend
 * Updated dynamically based on server response
 */
let currentMaxAttempts: number = DEFAULT_MAX_QUALITY_ATTEMPTS;

async function refreshMaxQualityAttempts(): Promise<void> {
  try {
    const response = await fetch("/api/quality-config");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | { data?: { maxQualityAttempts?: number } }
      | null;
    const maxQualityAttempts = payload?.data?.maxQualityAttempts;
    if (
      typeof maxQualityAttempts === "number" &&
      Number.isInteger(maxQualityAttempts) &&
      maxQualityAttempts > 0
    ) {
      currentMaxAttempts = maxQualityAttempts;
    }
  } catch (error) {
    // Ignore config fetch errors and keep default
  }
}

/**
 * Emits a text received event
 * @param clickCount - Current click count
 * @param attemptNumber - Current attempt number
 * @param summary - Summary text
 * @param qualityEvaluationId - Quality evaluation ID
 * @param hasQualityProcess - Whether quality process was performed
 * @param systemMessage - System message
 */
function emitTextReceived(
  clickCount: number,
  attemptNumber: number,
  summary: string,
  qualityEvaluationId: number,
  hasQualityProcess: boolean,
  systemMessage?: string,
): void {
  textProcessingEvents.emit<TextReceivedEventData>(
    TextProcessingEventType.TEXT_RECEIVED_FROM_DATABASE,
    {
      clickCount,
      attemptNumber,
      timestamp: Date.now(),
      text: summary,
      qualityEvaluationId,
      hasQualityProcess,
      systemMessage,
      isFinalAttempt: true,
    },
  );
}

/**
 * Emits a processing completed event
 * @param clickCount - Current click count
 * @param attemptNumber - Current attempt number
 * @param qualityScore - Optional quality score
 */
function emitProcessingCompleted(
  clickCount: number,
  attemptNumber: number,
  qualityScore?: number,
): void {
  textProcessingEvents.emit<ProcessingCompletedEventData>(
    TextProcessingEventType.PROCESSING_COMPLETED,
    {
      clickCount,
      attemptNumber,
      timestamp: Date.now(),
      finalScore: qualityScore,
      totalAttempts: attemptNumber,
    },
  );
}

/**
 * Handles the case when maximum quality attempts are reached
 */
function handleMaxAttemptsReached(
  clickCount: number,
  attemptNumber: number,
  result: any,
): void {
  console.log(
    `[TextQuality] Maximum attempts (${currentMaxAttempts}) reached. Displaying current text.`,
  );

  emitTextReceived(
    clickCount,
    attemptNumber,
    result.summary,
    result.qualityEvaluationId,
    true,
    result.systemMessage,
  );

  emitProcessingCompleted(clickCount, attemptNumber, result.qualityScore);
}

/**
 * Handles acceptable quality score
 */
function handleAcceptableQuality(
  clickCount: number,
  attemptNumber: number,
  result: any,
): void {
  console.log(
    `[TextQuality] Quality acceptable (${result.qualityScore}), displaying final result`,
  );

  emitTextReceived(
    clickCount,
    attemptNumber,
    result.summary,
    result.qualityEvaluationId,
    true,
    result.systemMessage,
  );

  emitProcessingCompleted(clickCount, attemptNumber, result.qualityScore);
}

/**
 * Handles incomplete quality evaluation
 */
function handleIncompleteQuality(
  clickCount: number,
  attemptNumber: number,
  result: any,
): void {
  console.log(
    `[TextQuality] Server-side quality evaluation incomplete, displaying text anyway`,
  );

  emitTextReceived(
    clickCount,
    attemptNumber,
    result.summary,
    result.qualityEvaluationId,
    false,
    result.systemMessage,
  );

  emitProcessingCompleted(clickCount, attemptNumber);
}

/**
 * Handles no quality evaluation (fast mode)
 */
function handleNoQualityEvaluation(
  clickCount: number,
  attemptNumber: number,
  result: any,
): void {
  console.log(
    `[TextQuality] No quality evaluation (fast mode), displaying text`,
  );

  emitTextReceived(
    clickCount,
    attemptNumber,
    result.summary,
    result.qualityEvaluationId,
    false,
    result.systemMessage,
  );

  emitProcessingCompleted(clickCount, attemptNumber);
}

/**
 * Handles quality evaluation retry
 */
async function handleQualityRetry(
  text: string,
  summaryOutput: HTMLTextAreaElement,
  clickCount: number,
  attemptNumber: number,
  result: any,
  abortSignal?: AbortSignal,
): Promise<void> {
  const nextAttempt = attemptNumber + 1;
  console.log(
    `[TextQuality] Resubmitting with server-side evaluation: attempt ${attemptNumber} -> ${nextAttempt}`,
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  return processSummaryWithQuality(
    text,
    summaryOutput,
    clickCount,
    nextAttempt,
    result.qualityEvaluationId,
    abortSignal,
  );
}

/**
 * Process the summary with quality resubmission handling
 * @param text - The text to process
 * @param summaryOutput - The output element to update
 * @param clickCount - The click count for logging
 * @param attemptNumber - The attempt number (defaults to 1)
 * @param previousQualityId - The previous quality ID if resubmitting
 * @param abortSignal - Optional abort signal for cancelling the request
 */
export async function processSummaryWithQuality(
  text: string,
  summaryOutput: HTMLTextAreaElement,
  clickCount: number,
  attemptNumber: number = 1,
  previousQualityId?: number,
  abortSignal?: AbortSignal,
): Promise<void> {
  console.log(
    `[TextQuality] Starting attempt ${attemptNumber}/${currentMaxAttempts} (${clickCount})`,
  );
  console.log(
    `[TextQuality] Abort signal available: ${abortSignal ? "YES" : "NO"}`,
  );

  // Show processing indicator with current attempt number
  // Quality evaluation happens instantly on backend, so no need for separate state
  const { showOutputLoadingIndicator } = await import(
    "../../ui/components/output-status.js"
  );
  showOutputLoadingIndicator(
    ProcessingState.PROCESSING,
    attemptNumber,
    currentMaxAttempts,
    STAGE_MESSAGES[ProcessingStage.ANALYSIS],
  );

  let stopProgressPolling: () => void = () => {};

  try {
    // Get selected values and add attempt information
    const formValues: FormValues = getSelectedValues();
    const processId = createClientProcessId();
    formValues.processId = processId;
    formValues.attemptNumber = attemptNumber;
    if (previousQualityId) {
      formValues.previousQualityId = previousQualityId;
    }

    stopProgressPolling = startProgressStream(
      processId,
      attemptNumber,
      () => currentMaxAttempts,
      abortSignal,
    );

    // Get summary using the exported getSummary function with abort signal
    const result = await getSummary(text, formValues, abortSignal);

    // Update currentMaxAttempts if backend provides it
    if (result.maxQualityAttempts) {
      currentMaxAttempts = result.maxQualityAttempts;
      console.log(
        `[TextQuality] Max attempts from backend: ${currentMaxAttempts}`,
      );
    }

    if (!result || !result.summary) {
      console.error("[TextQuality] No summary returned from API");

      textProcessingEvents.emit<ProcessingErrorEventData>(
        TextProcessingEventType.PROCESSING_ERROR,
        {
          clickCount,
          attemptNumber,
          timestamp: Date.now(),
          error: new Error("No summary returned from API"),
          errorMessage:
            "Ett fel uppstod vid bearbetningen. Försök igen senare.",
        },
      );
      return;
    }

    // Check if quality evaluation was performed
    if (result.qualityEvaluationId && formValues.qualityProcess !== false) {
      console.log(
        `[TextQuality] Server-side quality evaluation performed for record ${result.qualityEvaluationId}`,
      );

      // Handle low quality score - retry needed
      if (result.qualityScore !== undefined && result.needsResubmission) {
        console.log(
          `[TextQuality] Quality score too low (${result.qualityScore}), will retry with attempt ${attemptNumber + 1}`,
        );

        if (attemptNumber >= currentMaxAttempts) {
          handleMaxAttemptsReached(clickCount, attemptNumber, result);
          return;
        }

        return handleQualityRetry(
          text,
          summaryOutput,
          clickCount,
          attemptNumber,
          result,
          abortSignal,
        );
      }

      // Handle acceptable quality score
      if (result.qualityScore !== undefined && !result.needsResubmission) {
        handleAcceptableQuality(clickCount, attemptNumber, result);
      } else {
        // Handle incomplete quality evaluation
        handleIncompleteQuality(clickCount, attemptNumber, result);
      }
    } else {
      // No quality evaluation (fast mode)
      handleNoQualityEvaluation(clickCount, attemptNumber, result);
    }
  } catch (summaryError) {
    console.error("[TextQuality] Error getting summary:", summaryError);

    textProcessingEvents.emit<ProcessingErrorEventData>(
      TextProcessingEventType.PROCESSING_ERROR,
      {
        clickCount,
        attemptNumber,
        timestamp: Date.now(),
        error: summaryError as Error,
        errorMessage: "Ett fel uppstod vid bearbetningen. Försök igen senare.",
      },
    );

    await handleSummarizationError(summaryError as Error, clickCount);
  } finally {
    stopProgressPolling();
  }
}

// Add the qualityEvaluationTimeout property to the Window interface
declare global {
  interface Window {
    qualityEvaluationTimeout: ReturnType<typeof setTimeout> | null;
  }
}

// Initialize the timeout property
window.qualityEvaluationTimeout = null;
