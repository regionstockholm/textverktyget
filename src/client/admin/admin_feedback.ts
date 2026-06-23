export type AdminFeedbackType = "success" | "error" | "info";

export type AdminFeedback = {
  setStatus(message: string): void;
  showHint(message: string, type?: AdminFeedbackType): void;
  showButtonHint(
    button: HTMLElement | null,
    message: string,
    type?: AdminFeedbackType,
  ): void;
};

export function createAdminFeedback(
  statusEl: HTMLElement,
  hintEl: HTMLElement,
): AdminFeedback {
  let hintTimeout = 0;
  const buttonHintTimeouts = new WeakMap<HTMLElement, number>();

  const setStatus = (message: string): void => {
    statusEl.textContent = `Status: ${message}`;
  };

  const showHint = (
    message: string,
    type: AdminFeedbackType = "info",
  ): void => {
    hintEl.textContent = message;
    hintEl.dataset.state = type;
    if (hintTimeout) {
      window.clearTimeout(hintTimeout);
    }
    hintTimeout = window.setTimeout(() => {
      hintEl.textContent = "";
      hintEl.dataset.state = "";
    }, 3500);
  };

  const ensureButtonHint = (button: HTMLElement): HTMLElement | null => {
    let wrapper = button.parentElement;
    if (!wrapper) {
      return null;
    }
    if (!wrapper.classList.contains("admin-save-wrap")) {
      const wrap = document.createElement("span");
      wrap.className = "admin-save-wrap";
      wrapper.insertBefore(wrap, button);
      wrap.appendChild(button);
      wrapper = wrap;
    }

    let hint = wrapper.querySelector<HTMLElement>(".admin-save-hint");
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "admin-save-hint";
      hint.setAttribute("role", "status");
      hint.setAttribute("aria-live", "polite");
      wrapper.appendChild(hint);
    }

    return hint;
  };

  const showButtonHint = (
    button: HTMLElement | null,
    message: string,
    type: AdminFeedbackType = "info",
  ): void => {
    if (!button) {
      return;
    }

    const hint = ensureButtonHint(button);
    if (!hint) {
      return;
    }

    hint.textContent = message;
    hint.dataset.state = type;

    const existingTimeout = buttonHintTimeouts.get(hint);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }
    const timeoutId = window.setTimeout(() => {
      hint.textContent = "";
      hint.dataset.state = "";
    }, 3500);
    buttonHintTimeouts.set(hint, timeoutId);
  };

  return { setStatus, showHint, showButtonHint };
}
