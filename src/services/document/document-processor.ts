/**
 * Document Processing Service Module
 * Orchestrates text extraction from various document formats
 */

import { assert } from "../../utils/safety-utils.js";
import { logger } from "../../utils/logger.js";
import { isFileTypeSupported } from "./format-detector.js";
import {
  extractRawText,
  validateTextLength,
  cleanExtractedText,
} from "./text-extractor.js";

/**
 * Extracts text content from various document formats
 * Supports Word, Excel, PowerPoint, PDF, and text files
 *
 * @param buffer - Document content as buffer
 * @param filename - Original filename with extension
 * @returns Extracted and cleaned text content
 * @throws Error if file type is not supported
 * @throws Error if text extraction fails
 *
 * @example
 * try {
 *   const text = await extractTextFromDocument(fileBuffer, "document.docx");
 *   console.log("Extracted text:", text);
 * } catch (error) {
 *   console.error("Extraction failed:", error);
 * }
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  logger.info("document.extract.started", {
    processStatus: "running",
    meta: { filename, bufferSize: buffer.length },
  });

  try {
    // Validate inputs
    assert(Buffer.isBuffer(buffer), "Input must be a buffer");
    assert(typeof filename === "string", "Filename must be a string");

    // Validate file type based on extension
    if (!isFileTypeSupported(filename)) {
      logger.warn("document.extract.unsupported_type", {
        processStatus: "failed",
        meta: { filename },
      });
      throw new Error(`Unsupported file type: ${filename}`);
    }

    // Extract raw text
    const rawText = await extractRawText(buffer);

    // Validate text length
    validateTextLength(rawText);

    // Clean and return the text
    const cleanedText = cleanExtractedText(rawText);
    logger.info("document.extract.completed", {
      processStatus: "completed",
      meta: { filename, textLength: cleanedText.length },
    });

    return cleanedText;
  } catch (error) {
    logger.error("document.extract.failed", {
      processStatus: "failed",
      meta: { filename, error: error instanceof Error ? error.message : String(error) },
    });

    // Preserve unsupported file type errors
    if (
      error instanceof Error &&
      error.message.includes("Unsupported file type")
    ) {
      throw error;
    }

    // Wrap other errors with more context
    throw new Error(
      `Failed to extract text from document: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
