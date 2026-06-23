/**
 * Upload Status Module
 * Contains interfaces related to file upload status tracking
 */

/**
 * Interface for tracking file upload status
 */
export interface FileUploadStatus {
  inProgress: boolean;
  totalFiles: number;
  processedFiles: number;
  errors: string[];
}
