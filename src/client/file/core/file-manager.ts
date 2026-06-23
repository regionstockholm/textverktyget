import { fileLimits } from "../../../config/shared-config.js";
import { FileValidator } from "../../../utils/file/file-validator.js";
import type { FileInfo } from "../models/file-info.js";
import type { FileUploadStatus } from "../models/upload-status.js";
import { ElementManager } from "../ui/element-manager.js";
import { generateUniqueId, processFile } from "./file-processor.js";

type FilesDroppedEvent = CustomEvent<{ files?: FileList | File[] }>;

export class FileManager {
  private attachedFiles: Map<string, FileInfo>;
  private elementManager: ElementManager;
  private uploadStatus: FileUploadStatus;

  constructor(
    attachedFiles: Map<string, FileInfo>,
    elementManager: ElementManager,
  ) {
    this.attachedFiles = attachedFiles;
    this.elementManager = elementManager;
    this.uploadStatus = this.createEmptyUploadStatus();
    this.setupEventListeners();
  }

  private createEmptyUploadStatus(): FileUploadStatus {
    return {
      inProgress: false,
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
    };
  }

  private setupEventListeners(): void {
    document.addEventListener(
      "remove-all-files",
      this.clearAllFiles.bind(this),
    );
    document.addEventListener("files-dropped", (event: Event) => {
      const files = (event as FilesDroppedEvent).detail?.files;
      if (files) {
        this.handleFiles(files);
      }
    });
  }

  storeFile(file: File): boolean {
    try {
      const fileId = generateUniqueId();
      this.attachedFiles.set(fileId, { file, fileName: file.name });

      const listItem = this.elementManager.createFileListItem({
        fileName: file.name,
        fileId,
        fileSize: file.size,
        fileType: file.type,
      });

      const removeButton = listItem.querySelector<HTMLElement>(
        '[data-action="remove-file"]',
      );
      removeButton?.addEventListener("click", () => {
        const targetFileId = removeButton.dataset.id;
        if (targetFileId) {
          this.removeFile(targetFileId);
        }
      });

      this.elementManager.elements.fileList.appendChild(listItem);
      this.elementManager.updateFileArea();
      return true;
    } catch (error) {
      this.handleError("Failed to store file", error);
      return false;
    }
  }

  removeFile(fileId: string): void {
    this.attachedFiles.delete(fileId);
    document.querySelector(`[data-file-id="${fileId}"]`)?.remove();

    if (this.elementManager.elements.fileList.children.length === 0) {
      this.elementManager.elements.fileArea.classList.remove("has-files");
      this.elementManager.updateFileUploadContainer(false);
    }
  }

  clearAllFiles(): void {
    this.attachedFiles.clear();
    this.elementManager.elements.fileList.innerHTML = "";
    this.elementManager.elements.fileArea.classList.remove("has-files");
    this.elementManager.updateFileUploadContainer(false);
    this.uploadStatus = this.createEmptyUploadStatus();
  }

  handleFiles(files: FileList | File[]): void {
    if (this.uploadStatus.inProgress) {
      return;
    }

    const fileArray = Array.from(files);
    if (fileArray.length === 0) {
      return;
    }

    setTimeout(() => {
      this.processFiles(fileArray);
    }, fileLimits.fileProcessingDelay);
  }

  private processFiles(fileArray: File[]): void {
    this.uploadStatus = this.createEmptyUploadStatus();
    this.uploadStatus.inProgress = true;

    const remainingSlots = FileValidator.getRemainingSlots(
      this.attachedFiles.size,
    );
    if (remainingSlots <= 0) {
      this.showMaxFilesError();
      this.uploadStatus.inProgress = false;
      return;
    }

    this.uploadStatus.totalFiles = Math.min(fileArray.length, remainingSlots);

    const validFiles = this.filterValidFiles(fileArray);
    const filesToAdd = validFiles.slice(0, remainingSlots);
    const totalFiles = fileArray.length;

    this.updateContainerVisibility(filesToAdd.length);
    this.processBatches(filesToAdd, totalFiles, remainingSlots);
  }

  async processFileForText(file: File): Promise<string> {
    try {
      const validationResult = FileValidator.validateFile(
        file,
        this.attachedFiles,
      );
      if (!validationResult.isValid) {
        throw new Error(validationResult.errors.join(", "));
      }

      return processFile(file);
    } catch (error) {
      this.handleError("Error processing file for text", error);
      return "";
    }
  }

  private showMaxFilesError(): void {
    this.elementManager.showError(
      `Du kan inte lägga till fler än ${fileLimits.maxFiles} dokument.`,
    );
  }

  private processBatches(
    filesToAdd: File[],
    totalFiles: number,
    remainingSlots: number,
  ): void {
    let currentIndex = 0;
    let filesAdded = 0;

    const processBatch = () => {
      if (currentIndex >= filesToAdd.length) {
        this.finalizeUploadProcess(filesAdded, totalFiles, remainingSlots);
        return;
      }

      const batch = filesToAdd.slice(
        currentIndex,
        currentIndex + fileLimits.batchProcessingSize,
      );

      for (const file of batch) {
        if (this.storeFile(file)) {
          filesAdded += 1;
        }
        this.uploadStatus.processedFiles += 1;
      }

      currentIndex += batch.length;
      setTimeout(processBatch, fileLimits.batchProcessingSize);
    };

    processBatch();
  }

  private finalizeUploadProcess(
    filesAdded: number,
    totalFiles: number,
    remainingSlots: number,
  ): void {
    this.uploadStatus.inProgress = false;

    if (totalFiles > remainingSlots) {
      this.elementManager.showError(
        `Endast ${filesAdded} av filerna lades till. Maximal gräns på ${fileLimits.maxFiles} dokument har uppnåtts.`,
      );
    } else if (filesAdded > 0 && filesAdded < totalFiles) {
      this.elementManager.showError(
        `${filesAdded} av ${totalFiles} filer lades till. De övriga filerna kunde inte laddas upp.`,
      );
    }

    document.dispatchEvent(
      new CustomEvent("files-upload-complete", {
        detail: { filesAdded, totalFiles },
      }),
    );
  }

  private filterValidFiles(fileArray: File[]): File[] {
    const validFiles: File[] = [];
    this.uploadStatus.errors = [];

    for (const file of fileArray) {
      const validationResult = FileValidator.validateFile(
        file,
        this.attachedFiles,
      );
      if (!validationResult.isValid) {
        const errorMessage =
          validationResult.errors[0] || `Invalid file: ${file.name}`;
        this.uploadStatus.errors.push(errorMessage);

        if (this.uploadStatus.errors.length === 1) {
          this.elementManager.showError(errorMessage);
        }
        continue;
      }

      validFiles.push(file);
    }

    return validFiles;
  }

  private updateContainerVisibility(validFileCount: number): void {
    const hasFiles = validFileCount > 0 || this.attachedFiles.size > 0;
    this.elementManager.updateFileUploadContainer(hasFiles);
  }

  public getUploadStatus(): FileUploadStatus {
    return { ...this.uploadStatus };
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);

    if (error instanceof Error) {
      this.elementManager.showError(`${message}: ${error.message}`);
      return;
    }

    this.elementManager.showError(message);
  }
}
