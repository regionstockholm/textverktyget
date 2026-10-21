/**
 * Text Extractor Module
 * Core text extraction functionality using office-text-extractor
 */

import childProcess from "node:child_process";
import { fileURLToPath } from "node:url";
import { assert } from "../../utils/safety-utils.js";
import { timeLimits } from "../../config/shared-config.js";

let activeExtractions = 0;

/**
 * Extracts raw text from a document using office-text-extractor
 * @param buffer - Document content as buffer
 * @returns Raw extracted text
 * @throws Error if extraction fails or times out
 */
export async function extractRawText(buffer: Buffer): Promise<string> {
  assert(Buffer.isBuffer(buffer), "Input must be a buffer");

  if (activeExtractions >= 2) throw new Error("Document processing busy. Try again shortly.");
  activeExtractions++;
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = childProcess.execFile(process.execPath, [
        // shortcut: V8's heap limit excludes native allocations; use OS/container memory limits for hostile PDFs.
        "--max-old-space-size=256", fileURLToPath(new URL("./extract-process.js", import.meta.url)),
      ], {
        timeout: timeLimits.maxTimeoutDuration,
        killSignal: "SIGKILL",
        maxBuffer: 20 * 1024 * 1024,
        encoding: "utf8",
        env: { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV },
      }, (error, stdout) => {
        if (error) reject(new Error("Document processing failed, timed out or exceeded safety limits. No partial text will be used."));
        else resolve(stdout);
      });
      child.stdin!.on("error", () => {}); // Early child exit is reported by execFile's callback.
      child.stdin!.end(buffer);
    });
  } finally {
    activeExtractions--;
  }
}

/**
 * Validates the extracted text length
 * @param text - Extracted text to validate
 * @throws Error if no readable text was extracted
 */
export function validateTextLength(text: string): void {
  assert(typeof text === "string", "Text must be a string");

  assert(text.trim().length > 0, "Dokumentet gav ingen läsbar text. Skannade dokument kräver OCR.");
  // Model context limits are checked later against the entire extracted text.
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
