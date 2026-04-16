/**
 * Shared Application Configuration
 * Contains constants and configuration shared between client and server
 * NO process.env access allowed here to ensure browser compatibility
 */

// --- Power of Ten Safety Constants ---

// Basic iteration and processing limits
export const MAX_ITERATIONS = 1000;
export const MAX_TIMEOUT_DURATION = 30000; // 30 seconds
export const MAX_RATE_LIMIT = 1000;

// File processing limits
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_FILES = 10;
export const ERROR_MESSAGE_TIMEOUT = 5000; // 5 seconds

// Text processing limits
export const MAX_TEXT_LENGTH = Number.MAX_SAFE_INTEGER; // No practical limit
export const MIN_TEXT_LENGTH = 10;

// UI limits
export const MAX_ELEMENT_CHECKS = 50;
export const MAX_FILE_TYPES = 20;

// Safety configuration object for compatibility
export const safetyConfig = {
  MAX_ITERATIONS,
  MAX_TIMEOUT_DURATION,
  MAX_RATE_LIMIT,
  MAX_FILE_SIZE,
  MAX_TEXT_LENGTH,
  MIN_TEXT_LENGTH,
};

export const FileLimits = {
  MAX_FILE_SIZE,
  MAX_FILES,
  ERROR_MESSAGE_TIMEOUT,
  BATCH_PROCESSING_SIZE: 3,
  BATCH_PROCESSING_DELAY: 100,
  FILE_PROCESSING_DELAY: 100,
};

export const UILimits = {
  MAX_ELEMENT_CHECKS,
  MAX_FILE_TYPES,
  MAX_PROMPT_CONTENT_LENGTH: 1000,
};
