/**
 * File Processor Module
 * Core file processing utilities for handling document uploads
 */

import { assert } from "../../safety/assertions.js";
import { FileValidator } from "../../../utils/file/file-validator.js";
import { FileInfo } from "../models/file-info.js";
import { FileLimits } from "../../../config/shared-config.js";

/**
 * Interface for server response data
 */
interface ServerResponseData {
  text?: string;
  data?: {
    text: string;
    originalLength?: number;
    textLength?: number;
  };
  success?: boolean;
  [key: string]: any;
}

/**
 * Interface for error response data
 */
interface ErrorResponseData {
  message?: string;
  [key: string]: any;
}

/**
 * Interface for file upload payload
 */
interface FileUploadPayload {
  fileData: string;
  fileName: string;
}

/**
 * Generates a unique identifier by combining timestamp and random string
 * Used for assigning unique IDs to uploaded files
 * @returns A unique string identifier in base36 format
 */
export function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2);

  assert(typeof timestamp === "string", "Timestamp must be a string");
  assert(typeof randomStr === "string", "Random string must be a string");

  return timestamp + randomStr;
}

/**
 * Converts an ArrayBuffer to a base64 encoded string
 * Used for preparing file data for server upload
 * @param buffer - The array buffer to convert
 * @returns Base64 encoded string representation of the buffer
 * @private
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  assert(buffer instanceof ArrayBuffer, "Input must be an ArrayBuffer");
  assert(buffer.byteLength > 0, "Buffer cannot be empty");
  const MAX_FILE_SIZE = FileLimits.MAX_FILE_SIZE;
  assert(buffer.byteLength <= MAX_FILE_SIZE, "Buffer exceeds maximum size");

  let binary = "";
  const bytes = new Uint8Array(buffer);

  // Convert buffer to binary string
  // File size is already validated above (MAX_FILE_SIZE)
  for (let i = 0; i < bytes.length; i++) {
    // Uint8Array elements are numbers, so we can safely convert to character codes
    binary += String.fromCharCode(bytes[i] as number);
  }

  const result = window.btoa(binary);
  assert(typeof result === "string", "Base64 conversion failed");

  return result;
}

/**
 * Reads a file and returns its contents as an ArrayBuffer
 * @param file - The file to read
 * @returns Promise resolving to the file contents
 * @throws {Error} If file reading fails
 * @private
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  // Validate basic file properties, we're only interested in type and size here
  const validationResult = FileValidator.validateFile(
    file,
    new Map<string, FileInfo>(),
  );
  if (!validationResult.isValid) {
    throw new Error(validationResult.errors.join(", "));
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      const error = reader.error;
      const errorMessage = error ? error.message : "Unknown error";
      reject(new Error(`Error reading file "${file.name}": ${errorMessage}`));
    };

    reader.onload = () => {
      const result = reader.result as ArrayBuffer;
      assert(result instanceof ArrayBuffer, "Result must be an ArrayBuffer");
      assert(result.byteLength > 0, "Read buffer cannot be empty");
      const MAX_FILE_SIZE = FileLimits.MAX_FILE_SIZE;
      assert(
        result.byteLength <= MAX_FILE_SIZE,
        "Read buffer exceeds maximum size",
      );
      resolve(result);
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validates server response data
 * @param data - The response data to validate
 * @returns The validated text content
 * @throws {Error} If validation fails
 * @private
 */
function validateServerResponse(data: ServerResponseData): string {
  assert(data !== null, "Server response cannot be null");
  assert(typeof data === "object", "Server response must be an object");
  assert(typeof data.text === "string", "Server response must contain text");
  assert(data.text.length > 0, "Extracted text cannot be empty");

  return data.text;
}

/**
 * Sends file data to the server for processing
 * @param base64Data - Base64 encoded file data
 * @param fileName - The name of the file
 * @returns Promise resolving to the extracted text
 * @throws {Error} If server request fails
 * @private
 */
async function sendFileToServer(
  base64Data: string,
  fileName: string,
): Promise<string> {
  assert(typeof base64Data === "string", "Base64 data must be a string");
  assert(base64Data.length > 0, "Base64 data cannot be empty");
  assert(typeof fileName === "string", "File name must be a string");
  assert(fileName.length > 0, "File name cannot be empty");

  const payload: FileUploadPayload = {
    fileData: base64Data,
    fileName: fileName,
  };

  const response = await fetch("/upload/process-document", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = (await response.json()) as ErrorResponseData;
    const errorMessage =
      errorData && errorData.message
        ? errorData.message
        : `Failed to process document (Status: ${response.status})`;
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as ServerResponseData;
  // Check for data.data for backward compatibility
  if (data.data && typeof data.data.text === "string") {
    return validateServerResponse(data.data);
  }
  return validateServerResponse(data);
}

/**
 * Processes a file for upload by reading its contents and sending to server
 * Handles file reading, conversion to base64, and server communication
 *
 * @param file - The file object to process
 * @returns Promise resolving to the extracted text content
 * @throws {Error} If file processing fails for any reason
 */
export async function processFile(file: File): Promise<string> {
  console.log(`[FileProcessor] Starting to process file: ${file.name}`);
  console.log(
    `[FileProcessor] File size: ${file.size} bytes, type: ${file.type}`,
  );

  try {
    // Validate file metadata using standard validator
    // We pass an empty Map as we only need to validate type and size here
    console.log(`[FileProcessor] Validating file: ${file.name}`);
    const validationResult = FileValidator.validateFile(
      file,
      new Map<string, FileInfo>(),
    );
    if (!validationResult.isValid) {
      console.error(
        `[FileProcessor] Validation failed for ${file.name}:`,
        validationResult.errors,
      );
      throw new Error(validationResult.errors.join(", "));
    }
    console.log(`[FileProcessor] File validation passed for: ${file.name}`);

    // Read file as array buffer
    console.log(`[FileProcessor] Reading file as array buffer: ${file.name}`);
    const buffer = await readFileAsArrayBuffer(file);
    console.log(
      `[FileProcessor] Read ${buffer.byteLength} bytes from ${file.name}`,
    );

    // Convert to base64
    console.log(`[FileProcessor] Converting to base64: ${file.name}`);
    const base64Data = arrayBufferToBase64(buffer);
    console.log(
      `[FileProcessor] Base64 conversion complete, length: ${base64Data.length} characters`,
    );

    // Send to server
    console.log(`[FileProcessor] Sending file to server: ${file.name}`);
    const extractedText = await sendFileToServer(base64Data, file.name);
    console.log(
      `[FileProcessor] Received extracted text, length: ${extractedText.length} characters`,
    );
    console.log(
      `[FileProcessor] First 100 characters: ${extractedText.substring(0, 100)}...`,
    );

    return extractedText;
  } catch (error) {
    console.error(`[FileProcessor] Error processing file ${file.name}:`, error);
    // Re-throw with additional context
    if (error instanceof Error) {
      throw new Error(`File processing error: ${error.message}`);
    } else {
      throw new Error("Unknown file processing error");
    }
  }
}
