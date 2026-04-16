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

/**
 * Interface for tracking upload progress
 */
export interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
}

/**
 * Interface for batch processing status
 */
export interface BatchProcessingStatus {
  batchSize: number;
  currentBatch: number;
  totalBatches: number;
  filesProcessed: number;
  filesSucceeded: number;
  filesFailed: number;
}
