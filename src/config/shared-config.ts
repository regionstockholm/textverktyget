/**
 * Shared Application Configuration
 * Contains constants and configuration shared between client and server
 */

type FileLimits = {
  [key: string]: number;
  batchProcessingSize: number;
  maxFileSize: number;
  maxFiles: number;
  maxPromptContentLength: number;
  minTextLength: number;
};

type TimeLimits = {
  [key: string]: number;
  batchProcessingDelay: number;
  errorMessageTimeout: number;
  fileProcessingDelay: number;
  maxRateLimit: number;
  maxTimeoutDuration: number;
};

export const fileLimits: FileLimits = {
  batchProcessingSize: 3,
  maxFileSize: 100 * 1024 * 1024,
  maxFiles: 10,
  maxPromptContentLength: 1000,
  minTextLength: 10,
};

export const timeLimits: TimeLimits = {
  batchProcessingDelay: 100,
  errorMessageTimeout: 5000, //5 seconds
  fileProcessingDelay: 100,
  maxRateLimit: 1000,
  maxTimeoutDuration: 30000, // 30 seconds
};
