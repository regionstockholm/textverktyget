import type {
  FileInfo,
  FileValidationResult,
} from "../../client/file/models/file-info.js";
import { fileLimits } from "../../config/shared-config.js";
import {
  getSupportedExtensions,
  isSupportedFileType,
  SUPPORTED_FORMATS,
} from "./file-type-policy.js";

export { SUPPORTED_FORMATS };

export class FileValidator {
  static isFileTypeSupported(file: File): boolean {
    return isSupportedFileType(file.name, file.type);
  }

  static isFileSizeValid(file: File): boolean {
    return file.size > 0 && file.size <= fileLimits.maxFileSize;
  }

  static isFileAlreadyUploaded(
    file: File,
    attachedFiles: Map<string, FileInfo>,
  ): boolean {
    for (const fileInfo of attachedFiles.values()) {
      if (fileInfo.fileName === file.name) {
        return true;
      }
    }

    return false;
  }

  static getSupportedExtensions(): string {
    return getSupportedExtensions().join(", ");
  }

  static getSupportedExtensionsArray(): string[] {
    return getSupportedExtensions();
  }

  static getRemainingSlots(currentFileCount: number): number {
    return Math.max(0, fileLimits.maxFiles - currentFileCount);
  }

  static validateFile(
    file: File,
    attachedFiles: Map<string, FileInfo>,
  ): FileValidationResult {
    const errors: string[] = [];

    if (!this.isFileTypeSupported(file)) {
      errors.push(
        `Filen "${file.name}" stöds inte. Tillåtna format: ${this.getSupportedExtensions()}`,
      );
    }

    if (!this.isFileSizeValid(file)) {
      const maxSizeMB = fileLimits.maxFileSize / (1024 * 1024);
      errors.push(
        `Filen "${file.name}" är för stor. Maximal filstorlek är ${maxSizeMB}MB.`,
      );
    }

    if (this.isFileAlreadyUploaded(file, attachedFiles)) {
      errors.push(`Filen "${file.name}" är redan tillagd.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
