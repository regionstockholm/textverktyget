import { processSummaryWithQuality } from "../../core/quality/quality-evaluation-client.js";
import {
  textProcessingEvents,
  TextProcessingEventType,
} from "../../core/events/text-processing-events.js";
import {
  clearAbortController,
  createAbortController,
} from "../../core/app-state.js";
import { getById } from "../utils/dom.js";
import { updateButtonState } from "./button-state.js";
import { isSummarizeButtonCoolingDown } from "./text-processing-ui.js";

export type ProcessAttachedFiles = (
  text: string,
  clickCount: number,
) => Promise<string>;

type SummarizeElements = {
  textInput: HTMLTextAreaElement;
  summaryOutput: HTMLTextAreaElement;
  summarizeButton: HTMLButtonElement;
};

const initializedButtons = new WeakSet<Element>();

function markInitialized(element: Element): boolean {
  if (initializedButtons.has(element)) {
    return false;
  }

  initializedButtons.add(element);
  return true;
}

function getSummarizeElements(
  textInputId: string,
  summaryOutputId: string,
  summarizeButtonId: string,
): SummarizeElements | null {
  const textInput = getById<HTMLTextAreaElement>(textInputId);
  const summaryOutput = getById<HTMLTextAreaElement>(summaryOutputId);
  const summarizeButton = getById<HTMLButtonElement>(summarizeButtonId);

  if (!textInput || !summaryOutput || !summarizeButton) {
    return null;
  }

  return {
    textInput,
    summaryOutput,
    summarizeButton,
  };
}

function emitProcessingStarted(clickCount: number): void {
  textProcessingEvents.emit(TextProcessingEventType.PROCESSING_STARTED, {
    clickCount,
    attemptNumber: 1,
    timestamp: Date.now(),
  });
}

function emitProcessingError(
  clickCount: number,
  errorMessage: string,
  error: Error,
): void {
  textProcessingEvents.emit(TextProcessingEventType.PROCESSING_ERROR, {
    clickCount,
    attemptNumber: 1,
    timestamp: Date.now(),
    error,
    errorMessage,
  });
}

async function getTextToProcess(
  textInput: HTMLTextAreaElement,
  clickCount: number,
  processAttachedFiles?: ProcessAttachedFiles,
): Promise<string> {
  const text = textInput.value.trim();

  if (!processAttachedFiles) {
    return text;
  }

  return processAttachedFiles(text, clickCount);
}

function getProcessingError(error: unknown): {
  error: Error;
  message: string;
} {
  if (error instanceof Error && error.message.includes("cancelled")) {
    return {
      error,
      message: "Bearbetningen avbröts",
    };
  }

  return {
    error:
      error instanceof Error
        ? error
        : new Error("Unknown summarization error"),
    message: "Ett fel uppstod vid bearbetningen. Försök igen senare.",
  };
}

async function runSummarization(
  elements: SummarizeElements,
  clickCount: number,
  processAttachedFiles?: ProcessAttachedFiles,
): Promise<void> {
  const abortController = createAbortController();

  try {
    const text = await getTextToProcess(
      elements.textInput,
      clickCount,
      processAttachedFiles,
    );

    if (!text) {
      emitProcessingError(
        clickCount,
        "Du måste skriva eller lägga till text att bearbeta.",
        new Error("No text provided"),
      );
      return;
    }

    await processSummaryWithQuality(
      text,
      elements.summaryOutput,
      clickCount,
      1,
      undefined,
      abortController.signal,
    );
  } finally {
    clearAbortController();
  }
}

export function initializeSummarizeButton(
  textInputId: string,
  summaryOutputId: string,
  summarizeButtonId: string,
  processAttachedFiles?: ProcessAttachedFiles,
): boolean {
  const elements = getSummarizeElements(
    textInputId,
    summaryOutputId,
    summarizeButtonId,
  );

  if (!elements) {
    return false;
  }

  if (!markInitialized(elements.summarizeButton)) {
    return true;
  }

  let clickCount = 0;
  let isSummarizing = false;

  elements.summarizeButton.addEventListener("click", async () => {
    clickCount += 1;

    if (isSummarizing || isSummarizeButtonCoolingDown()) {
      return;
    }

    isSummarizing = true;
    updateButtonState(elements.summarizeButton, true);
    emitProcessingStarted(clickCount);

    try {
      await runSummarization(elements, clickCount, processAttachedFiles);
    } catch (error) {
      const processingError = getProcessingError(error);
      emitProcessingError(
        clickCount,
        processingError.message,
        processingError.error,
      );
    } finally {
      isSummarizing = false;
    }
  });

  return true;
}

export function initializeCancelButton(cancelButtonId: string): boolean {
  const cancelButton = getById<HTMLButtonElement>(cancelButtonId);
  if (!cancelButton) {
    return false;
  }

  if (!markInitialized(cancelButton)) {
    return true;
  }

  cancelButton.addEventListener("click", () => {
    import("../../core/app-state.js").then(({ cancelCurrentRequest }) => {
      if (!cancelCurrentRequest()) {
        return;
      }

      const originalText = cancelButton.textContent;
      cancelButton.textContent = "Avbruten";

      setTimeout(() => {
        if (originalText) {
          cancelButton.textContent = originalText;
        }
      }, 2000);
    });
  });

  return true;
}
