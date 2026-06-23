type ModalElements = {
  modal: HTMLDialogElement;
  closeButton: HTMLElement;
  cancelButton: HTMLButtonElement;
  submitButton: HTMLButtonElement;
  urlInput: HTMLInputElement;
  form: HTMLFormElement;
};

type WebFetchResponse = {
  success: boolean;
  data?: {
    content: string;
    url: string;
    contentLength: number;
    processingTime: number;
  };
  error?: string;
};

const MIN_URL_LENGTH_FOR_VALIDATION = 10;

let cachedElements: ModalElements | null = null;
let hasInitialized = false;

function isSetDomainUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === "www.regionstockholm.se" || hostname === "regionstockholm.se"
    );
  } catch {
    return false;
  }
}

async function fetchWebContent(url: string): Promise<string> {
  const response = await fetch("/api/fetch-web", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: WebFetchResponse = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch web content");
  }

  const content = data.data?.content || "";
  if (!content.trim()) {
    throw new Error("No content found in the response");
  }

  return content;
}

function insertContentIntoTextArea(content: string): void {
  const textArea = document.getElementById("text-input") as HTMLTextAreaElement | null;
  if (!textArea) {
    return;
  }

  textArea.value = content;
  textArea.setSelectionRange(0, 0);
  textArea.focus();
  textArea.dispatchEvent(new Event("input", { bubbles: true }));
}

function getModalElements(): ModalElements | null {
  if (cachedElements) {
    return cachedElements;
  }

  const modal = document.getElementById("www-fetcher-modal") as HTMLDialogElement | null;
  const closeButton = document.getElementById("www-fetcher-modal-close");
  const cancelButton = document.getElementById(
    "www-fetcher-cancel",
  ) as HTMLButtonElement | null;
  const submitButton = document.getElementById(
    "www-fetcher-submit",
  ) as HTMLButtonElement | null;
  const urlInput = document.getElementById("www-url-input") as HTMLInputElement | null;
  const form = document.getElementById("modal-form") as HTMLFormElement | null;

  if (!modal || !closeButton || !cancelButton || !submitButton || !urlInput || !form) {
    return null;
  }

  cachedElements = {
    modal,
    closeButton,
    cancelButton,
    submitButton,
    urlInput,
    form,
  };

  return cachedElements;
}

function setFormBusy(elements: ModalElements, busy: boolean): void {
  elements.submitButton.disabled = busy;
  elements.submitButton.textContent = busy ? "Hämtar..." : "Hämta text";
  elements.urlInput.disabled = busy;
  elements.cancelButton.disabled = busy;
}

function showModal(elements: ModalElements): void {
  elements.urlInput.value = "";
  setFormBusy(elements, false);

  if (!elements.modal.open) {
    elements.modal.showModal();
  }

  setTimeout(() => {
    elements.urlInput.focus();
  }, 50);
}

function hideModal(elements: ModalElements): void {
  if (elements.modal.open) {
    elements.modal.close();
  }
}

function validateUrlInput(url: string, elements: ModalElements): boolean {
  if (!url) {
    elements.urlInput.focus();
    return false;
  }

  try {
    new URL(url);
  } catch {
    alert("Ogiltig URL. Kontrollera att webbadressen är korrekt.");
    elements.urlInput.focus();
    return false;
  }

  if (!isSetDomainUrl(url)) {
    alert("Det går endast att hämta texter från www.regionstockholm.se");
    elements.urlInput.focus();
    return false;
  }

  return true;
}

function setupFormSubmission(
  elements: ModalElements,
  closeModal: () => void,
): void {
  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const url = elements.urlInput.value.trim();
    if (!validateUrlInput(url, elements)) {
      return;
    }

    setFormBusy(elements, true);

    try {
      const content = await fetchWebContent(url);
      insertContentIntoTextArea(content);
      closeModal();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Fel vid hämtning av webbsida:\n${errorMessage}`);
    } finally {
      setFormBusy(elements, false);
    }
  });
}

function setupUrlInputValidation(elements: ModalElements): void {
  elements.urlInput.addEventListener("input", () => {
    const url = elements.urlInput.value.trim();

    if (url && url.length > MIN_URL_LENGTH_FOR_VALIDATION) {
      try {
        new URL(url);

        if (!isSetDomainUrl(url)) {
          elements.urlInput.setCustomValidity(
            "Det går endast att hämta texter från www.regionstockholm.se",
          );
        } else {
          elements.urlInput.setCustomValidity("");
        }
      } catch {
        elements.urlInput.setCustomValidity("");
      }
      return;
    }

    elements.urlInput.setCustomValidity("");
  });
}

function setupBackdropClick(
  elements: ModalElements,
  closeModal: () => void,
): void {
  elements.modal.addEventListener("click", closeModal);

  const modalContent = elements.modal.querySelector(".modal-content");
  modalContent?.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

export function initializeWwwFetcherModal(): boolean {
  if (hasInitialized) {
    return true;
  }

  const triggerButton = document.getElementById("www-fetcher-button");
  const elements = getModalElements();

  if (!triggerButton || !elements) {
    return false;
  }

  hasInitialized = true;

  const closeModal = () => hideModal(elements);

  triggerButton.addEventListener("click", (event) => {
    event.preventDefault();
    showModal(elements);
  });

  elements.closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    closeModal();
  });

  elements.cancelButton.addEventListener("click", (event) => {
    event.preventDefault();
    closeModal();
  });

  setupFormSubmission(elements, closeModal);
  setupUrlInputValidation(elements);
  setupBackdropClick(elements, closeModal);

  return true;
}
