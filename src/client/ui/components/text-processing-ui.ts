import {
  textProcessingEvents,
  TextProcessingEventType,
} from "../../core/events/text-processing-events.js";
import type {
  ProcessingErrorEventData,
  TextReceivedEventData,
} from "../../core/events/text-processing-events.js";
import {
  hideOutputStatusIndicators,
  showOutputErrorIndicator,
  showOutputLoadingIndicator,
  showOutputSuccessIndicator,
} from "./output-status.js";
import { updateButtonState } from "./button-state.js";
import { getById } from "../utils/dom.js";

const COOLDOWN_DURATION_MS = 1000;

let hasInitialized = false;
let cooldownActive = false;
let cooldownTimeout: ReturnType<typeof setTimeout> | null = null;

function getSummarizeButton(): HTMLButtonElement | null {
  return getById<HTMLButtonElement>("summarize-button");
}

function setTextAreaValue(id: string, value: string): void {
  const textArea = getById<HTMLTextAreaElement>(id);
  if (!textArea) {
    return;
  }

  textArea.value = value;
  textArea.dispatchEvent(new Event("input"));
}

function clearCooldown(): void {
  if (cooldownTimeout === null) {
    return;
  }

  clearTimeout(cooldownTimeout);
  cooldownTimeout = null;
}

function finishCooldown(): void {
  const summarizeButton = getSummarizeButton();
  if (summarizeButton) {
    updateButtonState(summarizeButton, false);
    summarizeButton.classList.remove("cooldown-animation");
  }

  cooldownActive = false;
  clearCooldown();
}

function startCooldown(): void {
  const summarizeButton = getSummarizeButton();
  if (!summarizeButton) {
    return;
  }

  clearCooldown();
  cooldownActive = true;
  summarizeButton.classList.add("cooldown-animation");

  cooldownTimeout = setTimeout(() => {
    finishCooldown();
  }, COOLDOWN_DURATION_MS);
}

export function isSummarizeButtonCoolingDown(): boolean {
  return cooldownActive;
}

export function initializeTextProcessingUi(): void {
  if (hasInitialized) {
    return;
  }

  hasInitialized = true;

  textProcessingEvents.on(TextProcessingEventType.PROCESSING_STARTED, () => {
    hideOutputStatusIndicators();
    showOutputLoadingIndicator();
    setTextAreaValue("summary-output", "");
  });

  textProcessingEvents.on<TextReceivedEventData>(
    TextProcessingEventType.TEXT_RECEIVED_FROM_DATABASE,
    (data) => {
      setTextAreaValue("summary-output", data.text);

      if (typeof data.systemMessage === "string") {
        setTextAreaValue("prompt-output", data.systemMessage.trim());
      }

      if (!data.hasQualityProcess) {
        showOutputSuccessIndicator(2000);
      }
    },
  );

  textProcessingEvents.on(TextProcessingEventType.PROCESSING_COMPLETED, () => {
    showOutputSuccessIndicator(2000);
    startCooldown();
  });

  textProcessingEvents.on<ProcessingErrorEventData>(
    TextProcessingEventType.PROCESSING_ERROR,
    (data) => {
      showOutputErrorIndicator(data.errorMessage, 5000);
      finishCooldown();
    },
  );
}
