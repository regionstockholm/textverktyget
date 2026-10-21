import { assert } from "../../safety/assertions.js";
import { createElement } from "../../ui/utils/dom.js";

export type RequiredElements = {
  dropZone: HTMLElement;
  fileUploadContainer: HTMLElement;
  fileArea: HTMLElement;
  absoluteArea: HTMLElement;
  relativeArea: HTMLElement;
  fileElemButton: HTMLElement;
  fileList: HTMLElement;
  textInput: HTMLElement;
  removeFilesButton?: HTMLElement;
  errorMessage?: HTMLElement;
};

export type FileListItemConfig = {
  fileName: string;
  fileId: string;
  fileSize?: number;
  fileType?: string;
};

const REQUIRED_ELEMENT_KEYS = [
  "dropZone",
  "fileUploadContainer",
  "fileArea",
  "absoluteArea",
  "relativeArea",
  "fileElemButton",
  "fileList",
  "textInput",
] as const;

const FILE_INPUT_ID = "fileInputElem";
const ERROR_TIMEOUT_MS = 5000;

export class ElementManager {
  public elements: RequiredElements;

  constructor(elements: RequiredElements) {
    this.elements = elements;
    this.validateRequiredElements();
    this.ensureErrorMessageElement();
  }

  private validateRequiredElements(): void {
    for (const key of REQUIRED_ELEMENT_KEYS) {
      assert(
        this.elements[key] instanceof HTMLElement,
        `${key} element not found`,
      );
    }
  }

  private ensureErrorMessageElement(): void {
    if (this.elements.errorMessage) {
      return;
    }

    const errorMessage = createElement("div", {
      className: "attachment-text error-message",
      style: "display: none; color: #B21544;",
    });

    this.elements.errorMessage = errorMessage;

    const buttonContainer = this.elements.fileElemButton.closest(
      ".flex.flex-column.flex-wrap.gap-2",
    );
    const attachmentText = buttonContainer?.querySelector("p.attachment-text");

    if (buttonContainer && attachmentText) {
      buttonContainer.insertBefore(errorMessage, attachmentText);
      return;
    }

    this.elements.fileUploadContainer.appendChild(errorMessage);
  }

  public showError(message: string): boolean {
    if (message.trim().length === 0) {
      return false;
    }

    this.ensureErrorMessageElement();

    if (!this.elements.errorMessage) {
      return false;
    }

    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.style.display = "block";

    window.setTimeout(() => {
      this.hideError();
    }, ERROR_TIMEOUT_MS);

    return true;
  }

  public hideError(): boolean {
    if (!this.elements.errorMessage) {
      return true;
    }

    this.elements.errorMessage.textContent = "";
    this.elements.errorMessage.style.display = "none";
    return true;
  }

  public createFileInput(acceptedTypes: string[]): HTMLInputElement {
    document.getElementById(FILE_INPUT_ID)?.remove();

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.id = FILE_INPUT_ID;
    fileInput.accept = acceptedTypes.length > 0 ? acceptedTypes.join(", ") : "*";
    fileInput.style.display = "none";

    document.body.appendChild(fileInput);
    return fileInput;
  }

  public createFileListItem(config: FileListItemConfig): HTMLElement {
    const listItem = createElement("div", {
      className:
        "flex flex-row flex-space-between flex-align-items-center gap-8 word-break-all file-item",
      dataset: { fileId: config.fileId },
    });

    listItem.append(
      this.createFileInfoContainer(config),
      this.createRemoveButton(config.fileId),
    );

    return listItem;
  }

  private createFileInfoContainer(config: FileListItemConfig): HTMLElement {
    const fileInfo = createElement("div", {
      className: "flex flex-row flex-align-items-center gap-4",
    });

    const icon = createElement("div", { className: "file-icon" });
    icon.innerHTML = this.getFileIconSVG(config.fileType || "");

    const name = createElement("span", {}, config.fileName);

    fileInfo.append(icon, name);

    if (typeof config.fileSize === "number") {
      const fileSize = createElement(
        "span",
        { className: "file-size" },
        `(${this.formatFileSize(config.fileSize)})`,
      );
      fileInfo.appendChild(fileSize);
    }

    return fileInfo;
  }

  private createRemoveButton(fileId: string): HTMLButtonElement {
    const removeButton = createElement("button", {
      className:
        "flex flex-row flex-justify-content-center flex-align-items-center gap-2 text-sm outline-blue filled-white small-button",
      dataset: {
        action: "remove-file",
        id: fileId,
      },
    }) as HTMLButtonElement;

    removeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M3.05 17.2a10 10 0 1 1 13.9-14.4 10 10 0 0 1-13.9 14.4Zm1.41-1.42A8 8 0 1 0 15.78 4.46 8 8 0 0 0 4.46 15.78Zm9.9-8.49-2.83 2.83 2.83 2.83-1.4 1.41-2.84-2.83-2.83 2.83-1.4-1.4 2.82-2.84L5.88 7.3 7.3 5.9l2.83 2.82 2.83-2.83 1.41 1.41Z"></path>
      </svg>
      <span>Ta bort</span>
    `;

    return removeButton;
  }

  private getFileIconSVG(fileType: string): string {
    if (
      fileType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(fileType)
    ) {
      return `<svg viewBox="0 0 35 44" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" width="25" height="31">
        <rect width="31" height="40" x="2" y="2" rx="7"></rect>
        <path d="M8 30l5-5 4 4 8-8 5 5"></path>
        <circle cx="22" cy="14" r="3"></circle>
      </svg>`;
    }

    if (fileType === "application/pdf" || fileType.endsWith(".pdf")) {
      return `<svg viewBox="0 0 35 44" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" width="25" height="31">
        <rect width="31" height="40" x="2" y="2" rx="7"></rect>
        <path d="M10 22h15M10 15h15M10 29h8"></path>
      </svg>`;
    }

    return `<svg viewBox="0 0 35 44" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" width="25" height="31"><path d="M8 11.5h19M8 18.5h19M8 25.5h19M8 32.5h12"></path>
      <rect width="31" height="40" x="2" y="2" rx="7"></rect>
    </svg>`;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return "0 B";
    }

    const sizes = ["B", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = parseFloat((bytes / Math.pow(1024, index)).toFixed(1));

    return `${size} ${sizes[index]}`;
  }

  public updateFileArea(): boolean {
    const hasFiles = this.elements.fileList.children.length > 0;
    this.elements.fileArea.classList.toggle("has-files", hasFiles);
    return true;
  }

  public updateFileUploadContainer(hasFiles: boolean): boolean {
    this.elements.fileUploadContainer.classList.toggle("visible", hasFiles);
    return true;
  }
}
