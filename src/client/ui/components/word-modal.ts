type WordModalElements = {
  modal: HTMLDialogElement;
  closeButton: HTMLElement;
  closeActionButton: HTMLButtonElement;
  contentDiv: HTMLDivElement;
};

let cachedElements: WordModalElements | null = null;
let hasInitialized = false;

const convertToWordOptimizedHTML = (text: string): string => {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const paragraphs = escaped.split(/\n\n|\r\n\r\n/);

  return paragraphs
    .map((paragraph) => {
      const linesWithBreaks = paragraph.replace(/\n|\r\n/g, "<br>");
      return `<p style="margin: 0 0 6pt 0; line-height: 1.15; font-family: Calibri, sans-serif; font-size: 11pt;">${linesWithBreaks}</p>`;
    })
    .join("\n");
};

function getWordModalElements(): WordModalElements | null {
  if (cachedElements) {
    return cachedElements;
  }

  const modal = document.getElementById("word-modal") as HTMLDialogElement | null;
  const closeButton = document.getElementById("word-modal-close");
  const closeActionButton = document.getElementById(
    "word-modal-close-action",
  ) as HTMLButtonElement | null;
  const contentDiv = document.getElementById(
    "word-modal-content",
  ) as HTMLDivElement | null;

  if (!modal || !closeButton || !closeActionButton || !contentDiv) {
    return null;
  }

  cachedElements = {
    modal,
    closeButton,
    closeActionButton,
    contentDiv,
  };

  return cachedElements;
}

function hideModal(elements: WordModalElements): void {
  if (elements.modal.open) {
    elements.modal.close();
  }
}

export function initializeWordModal(): boolean {
  if (hasInitialized) {
    return true;
  }

  const elements = getWordModalElements();
  if (!elements) {
    return false;
  }

  hasInitialized = true;

  const close = (event?: Event) => {
    event?.preventDefault();
    hideModal(elements);
  };

  elements.closeButton.addEventListener("click", close);
  elements.closeActionButton.addEventListener("click", close);
  elements.modal.addEventListener("click", () => hideModal(elements));

  const modalContent = elements.modal.querySelector(".modal-content");
  modalContent?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  return true;
}

export function showWordModal(text: string): void {
  if (!initializeWordModal()) {
    return;
  }

  const elements = getWordModalElements();
  if (!elements) {
    return;
  }

  elements.contentDiv.innerHTML = convertToWordOptimizedHTML(text);

  if (!elements.modal.open) {
    elements.modal.showModal();
  }

  setTimeout(() => {
    elements.contentDiv.focus();
  }, 50);
}
