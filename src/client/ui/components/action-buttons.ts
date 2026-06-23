import { timeLimits } from "../../../config/shared-config.js";
import { copyToClipboard } from "./clipboard.js";
import { updateButtonState } from "./button-state.js";
import { getById, query } from "../utils/dom.js";

const initializedButtons = new WeakSet<Element>();

function markInitialized(element: Element): boolean {
  if (initializedButtons.has(element)) {
    return false;
  }

  initializedButtons.add(element);
  return true;
}

export function initializeCopyButton(
  copyButton: HTMLButtonElement,
  getTextToCopy: () => string,
): boolean {
  if (!markInitialized(copyButton)) {
    return true;
  }

  copyButton.addEventListener("click", async () => {
    const text = getTextToCopy();
    if (!text) {
      return;
    }

    updateButtonState(copyButton, true);
    await copyToClipboard(text);

    setTimeout(
      () => {
        updateButtonState(copyButton, false);
      },
      Math.min(1500, timeLimits.maxTimeoutDuration),
    );
  });

  return true;
}

export function initializeWordModalButton(
  modalButton: HTMLButtonElement,
  getTextToCopy: () => string,
): boolean {
  if (!markInitialized(modalButton)) {
    return true;
  }

  modalButton.addEventListener("click", async () => {
    const text = getTextToCopy();
    if (!text) {
      return;
    }

    const { showWordModal } = await import("./word-modal.js");
    showWordModal(text);
  });

  return true;
}

export function initializePromptButton(
  promptButton: HTMLButtonElement,
  finalPrompt: HTMLElement,
): boolean {
  if (!markInitialized(promptButton)) {
    return true;
  }

  promptButton.addEventListener("click", () => {
    const isHidden = finalPrompt.style.display === "none";
    finalPrompt.style.display = isHidden ? "block" : "none";
  });

  return true;
}

export function initializeUpdateInfoButton(): boolean {
  const updateButton = query<HTMLButtonElement>(".update-button");
  const updateInfo = getById<HTMLElement>("update-info");

  if (!updateButton || !updateInfo) {
    return false;
  }

  if (!markInitialized(updateButton)) {
    return true;
  }

  let expanded = false;

  updateButton.addEventListener("click", () => {
    expanded = !expanded;
    updateInfo.style.display = expanded ? "block" : "none";

    const arrowIcon = updateButton.querySelector("svg");
    if (arrowIcon) {
      arrowIcon.style.transform = expanded ? "rotate(180deg)" : "rotate(0)";
    }
  });

  return true;
}
