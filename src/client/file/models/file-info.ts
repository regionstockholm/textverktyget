/**
 * File Info Module
 * Contains interfaces related to file handling
 */

/**
 * Interface for file information stored in the attachedFiles Map
 * Used throughout the application for file management
 */
export interface FileInfo {
  file: File;
  fileName: string;
}

/**
 * Interface for file validation results
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Interface for processed file data
 */
export interface ProcessedFile {
  id: string;
  name: string;
  content: string;
  size: number;
}
