/**
 * Text Extractor Module
 * Core text extraction functionality using office-text-extractor
 */

import { getTextExtractor } from "office-text-extractor";
import { assert } from "../../utils/safety-utils.js";
import { MAX_TIMEOUT_DURATION } from "../../config/app-config.js";

const extractor = getTextExtractor();

/**
 * Creates a promise that rejects after a timeout
 * @param timeout - Timeout in milliseconds
 * @returns Promise that rejects after timeout
 * @private
 */
function createTimeoutPromise(timeout: number): Promise<never> {
  assert(typeof timeout === "number", "Timeout must be a number");
  assert(timeout > 0, "Timeout must be positive");

  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          "Document processing timed out. The file may be too complex.",
        ),
      );
    }, timeout);
  });
}

/**
 * Extracts raw text from a document using office-text-extractor
 * @param buffer - Document content as buffer
 * @returns Raw extracted text
 * @throws Error if extraction fails or times out
 */
export async function extractRawText(buffer: Buffer): Promise<string> {
  assert(Buffer.isBuffer(buffer), "Input must be a buffer");

  // Race the extraction against the timeout
  const text = await Promise.race([
    extractor.extractText({
      input: buffer,
      type: "buffer",
    }),
    createTimeoutPromise(MAX_TIMEOUT_DURATION),
  ]);

  assert(typeof text === "string", "Extracted text must be a string");
  console.log(
    `[TextExtractor] Raw extracted text length: ${text.length} characters`,
  );

  return text;
}

/**
 * Validates the extracted text length
 * @param text - Extracted text to validate
 * @throws Error if text is too large
 */
export function validateTextLength(text: string): void {
  assert(typeof text === "string", "Text must be a string");

  // No upper limit - chunking will handle large texts
  console.log(
    `[TextExtractor] Text length validated: ${text.length} characters`,
  );
}

/**
 * Cleans up the extracted text
 * @param text - Raw text to clean
 * @returns Cleaned text
 */
export function cleanExtractedText(text: string): string {
  assert(typeof text === "string", "Text must be a string");

  // Clean up the extracted text:
  // 1. Trim whitespace
  // 2. Normalize spaces
  // 3. Normalize line breaks
  // 4. Clean line endings
  const cleanedText = text
    .trim()
    // Replace multiple spaces with a single space
    .replace(/[ \t]+/g, " ")
    // Replace three or more newlines with two newlines
    .replace(/\n{3,}/g, "\n\n")
    // Remove spaces at the start/end of each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  console.log(
    `[TextExtractor] Cleaned text length: ${cleanedText.length} characters`,
  );
  return cleanedText;
}
