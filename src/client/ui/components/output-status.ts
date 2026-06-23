import { timeLimits } from "../../../config/shared-config.js";
import {
  ProcessingState,
  formatStageStatusMessage,
  formatStatusMessage,
  getDefaultStatusMessage,
} from "../constants/status-messages.js";

type StatusElements = {
  container: HTMLElement;
  loadingIndicator: HTMLElement;
  successIndicator: HTMLElement;
  errorIndicator: HTMLElement;
};

let activeHideTimeout: ReturnType<typeof setTimeout> | null = null;

function getStatusElements(): StatusElements | null {
  const container = document.getElementById("output-status-indicators");
  const loadingIndicator = document.getElementById("output-loading-indicator");
  const successIndicator = document.getElementById("output-success-indicator");
  const errorIndicator = document.getElementById("output-error-indicator");

  if (!container || !loadingIndicator || !successIndicator || !errorIndicator) {
    return null;
  }

  return {
    container,
    loadingIndicator,
    successIndicator,
    errorIndicator,
  };
}

function clearHideTimeout(): void {
  if (activeHideTimeout === null) {
    return;
  }

  clearTimeout(activeHideTimeout);
  activeHideTimeout = null;
}

function getStatusTextElement(): HTMLElement | null {
  const loadingIndicator = document.getElementById("output-loading-indicator");
  return loadingIndicator?.querySelector(".status-text") as HTMLElement | null;
}

function setActiveIndicator(
  elements: StatusElements,
  active: "loading" | "success" | "error" | "none",
): void {
  elements.loadingIndicator.classList.toggle("active", active === "loading");
  elements.successIndicator.classList.toggle("active", active === "success");
  elements.errorIndicator.classList.toggle("active", active === "error");
}

function updateLoadingText(
  state: ProcessingState,
  attemptNumber?: number,
  maxAttempts?: number,
  stageMessage?: string,
): void {
  const statusTextElement = getStatusTextElement();
  if (!statusTextElement) {
    return;
  }

  if (stageMessage && attemptNumber && maxAttempts) {
    statusTextElement.textContent = formatStageStatusMessage(
      stageMessage,
      attemptNumber,
      maxAttempts,
    );
    return;
  }

  if (attemptNumber && maxAttempts) {
    statusTextElement.textContent = formatStatusMessage(
      state,
      attemptNumber,
      maxAttempts,
    );
    return;
  }

  statusTextElement.textContent = getDefaultStatusMessage();
}

function getSafeDuration(duration: number, fallback: number): number {
  if (typeof duration !== "number" || duration <= 0) {
    return fallback;
  }

  return Math.min(duration, timeLimits.maxTimeoutDuration);
}

function scheduleHide(duration: number): void {
  clearHideTimeout();
  activeHideTimeout = setTimeout(() => {
    hideOutputStatusIndicators();
    activeHideTimeout = null;
  }, duration);
}

export function showOutputLoadingIndicator(
  state: ProcessingState = ProcessingState.PROCESSING,
  attemptNumber?: number,
  maxAttempts?: number,
  stageMessage?: string,
): boolean {
  const elements = getStatusElements();
  if (!elements) {
    return false;
  }

  clearHideTimeout();
  setActiveIndicator(elements, "loading");
  updateLoadingText(state, attemptNumber, maxAttempts, stageMessage);
  return true;
}

export function showOutputSuccessIndicator(duration: number = 2000): boolean {
  const elements = getStatusElements();
  if (!elements) {
    return false;
  }

  setActiveIndicator(elements, "success");
  scheduleHide(getSafeDuration(duration, 2000));
  return true;
}

export function showOutputErrorIndicator(
  message: string = "Något gick fel, försök igen.",
  duration: number = 5000,
): boolean {
  const elements = getStatusElements();
  if (!elements) {
    return false;
  }

  const errorTextElement =
    elements.errorIndicator.querySelector(".status-text");
  if (errorTextElement && message) {
    errorTextElement.textContent = message;
  }

  setActiveIndicator(elements, "error");
  scheduleHide(getSafeDuration(duration, 5000));
  return true;
}

export function hideOutputStatusIndicators(): boolean {
  const elements = getStatusElements();
  if (!elements) {
    return false;
  }

  clearHideTimeout();
  setActiveIndicator(elements, "none");
  return true;
}
