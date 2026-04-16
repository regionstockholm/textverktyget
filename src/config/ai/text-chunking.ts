/**
 * Text Chunking Module
 * Provides functionality for breaking text into manageable chunks for AI processing
 * @module config/ai/text-chunking
 */

import { assert } from "../../utils/safety-utils.js";
import {
  AI_CONFIG,
  AI_PROVIDERS,
  type AIProvider,
  DEFAULT_PROVIDER,
} from "./ai-config.js";
import { safetyConfig } from "../app-config.js";

/**
 * Gets the current AI configuration
 *
 * @returns {Object} Current AI configuration
 */
export function getCurrentAIConfig() {
  // Assert preconditions
  assert(AI_CONFIG !== undefined, "AI configuration is required");
  assert(AI_PROVIDERS !== undefined, "AI providers configuration is required");
  assert(DEFAULT_PROVIDER !== undefined, "Default AI provider is required");

  // Get the current provider from environment variable or use default
  const currentProvider =
    (process.env.AI_PROVIDER as AIProvider) || DEFAULT_PROVIDER;

  // Check return value
  const config = AI_CONFIG[currentProvider];
  assert(
    config !== undefined,
    `Configuration for provider '${currentProvider}'not found`,
  );

  return config;
}

/**
 * Validates chunk parameters
 *
 * @param {string} text - Text to chunk
 * @param {number} maxChunkSize - Maximum chunk size
 * @returns {boolean} True if parameters are valid
 * @throws {Error} If parameters are invalid
 */
export function validateChunkParameters(
  text: string,
  maxChunkSize: number,
): boolean {
  assert(typeof text === "string", "Text must be a string");
  assert(typeof maxChunkSize === "number", "Max chunk size must be a number");
  assert(maxChunkSize > 0, "Max chunk size must be positive");
  assert(text.length > 0, "Text cannot be empty");

  return true;
}

/**
 * Splits text into paragraphs
 *
 * @param {string} text - Text to split
 * @returns {string[]} Array of paragraphs
 */
export function splitTextIntoParagraphs(text: string): string[] {
  assert(typeof text === "string", "Text must be a string");

  // Split text by double newlines (paragraphs)
  return text
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0);
}

/**
 * Processes a paragraph by sentences
 *
 * @param {string} paragraph - Paragraph to process
 * @param {string[]} chunks - Array of chunks
 * @param {number} maxChunkSize - Maximum chunk size
 * @returns {void}
 */
export function processParagraphBySentences(
  paragraph: string,
  chunks: string[],
  maxChunkSize: number,
): void {
  assert(typeof paragraph === "string", "Paragraph must be a string");
  assert(Array.isArray(chunks), "Chunks must be an array");
  assert(typeof maxChunkSize === "number", "Max chunk size must be a number");
  assert(paragraph.length > 0, "Paragraph cannot be empty");

  // If paragraph is small enough, add it to the current chunk
  if (paragraph.length <= maxChunkSize) {
    addParagraphToChunk(
      paragraph,
      chunks[chunks.length - 1] || "",
      chunks,
      maxChunkSize,
    );
    return;
  }

  // Split paragraph into sentences
  const sentenceRegex = /[. !?]+\s+/;
  const sentences = paragraph.split(sentenceRegex);

  // Bounded loop
  const iterationLimit = Math.min(
    sentences.length,
    safetyConfig.MAX_ITERATIONS,
  );

  // Declare variables in smallest scope
  let currentSentenceGroup = "";

  // Simple control flow
  for (let i = 0; i < iterationLimit; i++) {
    const sentence = sentences[i];

    // Skip empty sentences
    if (!sentence || !sentence.trim()) continue;

    // If adding this sentence would exceed the chunk size, start a new group
    if (
      currentSentenceGroup.length + sentence.length > maxChunkSize &&
      currentSentenceGroup.length > 0
    ) {
      // Add the current group to chunks
      addParagraphToChunk(
        currentSentenceGroup,
        chunks[chunks.length - 1] || "",
        chunks,
        maxChunkSize,
      );
      currentSentenceGroup = sentence;
    } else {
      // Add sentence to the current group
      currentSentenceGroup += (currentSentenceGroup ? " " : "") + sentence;
    }
  }

  // Add any remaining sentences
  if (currentSentenceGroup.length > 0) {
    addParagraphToChunk(
      currentSentenceGroup,
      chunks[chunks.length - 1] || "",
      chunks,
      maxChunkSize,
    );
  }
}

/**
 * Adds a paragraph to a chunk
 *
 * @param {string} paragraph - Paragraph to add
 * @param {string} currentChunk - Current chunk
 * @param {string[]} chunks - Array of chunks
 * @param {number} maxChunkSize - Maximum chunk size
 * @returns {void}
 */
export function addParagraphToChunk(
  paragraph: string,
  currentChunk: string,
  chunks: string[],
  maxChunkSize: number,
): void {
  assert(typeof paragraph === "string", "Paragraph must be a string");
  assert(typeof currentChunk === "string", "Current chunk must be a string");
  assert(Array.isArray(chunks), "Chunks must be an array");
  assert(typeof maxChunkSize === "number", "Max chunk size must be a number");
  assert(paragraph.length > 0, "Paragraph cannot be empty");

  // If the paragraph is too large for a single chunk, process it by sentences
  if (paragraph.length > maxChunkSize) {
    processParagraphBySentences(paragraph, chunks, maxChunkSize);
    return;
  }

  // If adding this paragraph would exceed the chunk size, start a new chunk
  if (
    currentChunk.length + paragraph.length + 2 > maxChunkSize &&
    currentChunk.length > 0
  ) {
    // Start a new chunk
    chunks.push(paragraph);
  } else {
    // Add paragraph to the current chunk
    const separator = currentChunk.length > 0 ? "\n\n" : "";
    const newChunk = currentChunk + separator + paragraph;

    if (chunks.length === 0) {
      chunks.push(newChunk);
    } else {
      chunks[chunks.length - 1] = newChunk;
    }
  }
}

/**
 * Processes text paragraphs
 *
 * @param {string[]} paragraphs - Array of paragraphs
 * @param {number} maxParagraphs - Maximum number of paragraphs to process
 * @param {number} maxChunkSize - Maximum chunk size
 * @returns {string[]} Array of chunks
 */
export function processTextParagraphs(
  paragraphs: string[],
  maxParagraphs: number,
  maxChunkSize: number,
): string[] {
  // Rule 5: Assert preconditions
  assert(Array.isArray(paragraphs), "Paragraphs must be an array");
  assert(typeof maxParagraphs === "number", "Max paragraphs must be a number");
  assert(typeof maxChunkSize === "number", "Max chunk size must be a number");
  assert(maxParagraphs > 0, "Max paragraphs must be positive");
  assert(maxChunkSize > 0, "Max chunk size must be positive");

  // Declare variables in smallest scope
  const chunks: string[] = [];

  // Bounded loop
  const iterationLimit = Math.min(
    paragraphs.length,
    maxParagraphs,
    safetyConfig.MAX_ITERATIONS,
  );

  // Simple control flow
  for (let i = 0; i < iterationLimit; i++) {
    const paragraph = paragraphs[i]?.trim();

    // Skip empty paragraphs
    if (!paragraph || paragraph.length === 0) continue;

    // Get the current chunk or create a new one
    // Using empty string as default ensures currentChunk is never undefined
    const currentChunk =
      chunks.length > 0 ? chunks[chunks.length - 1] || "" : "";

    // Add paragraph to chunk
    addParagraphToChunk(paragraph, currentChunk, chunks, maxChunkSize);
  }

  return chunks;
}

/**
 * Chunks text into smaller pieces
 *
 * @param {string} text - Text to chunk
 * @param {number} [maxChunkSize=getCurrentAIConfig().MAX_CHUNK_SIZE] - Maximum chunk size
 * @returns {string[]} Array of chunks
 */
export function chunkText(
  text: string,
  maxChunkSize: number = getCurrentAIConfig().MAX_CHUNK_SIZE,
): string[] {
  // Validate parameters
  validateChunkParameters(text, maxChunkSize);

  // If text is small enough, return it as a single chunk
  if (text.length <= maxChunkSize) {
    return [text];
  }

  // Split text into paragraphs
  const paragraphs = splitTextIntoParagraphs(text);

  // Process paragraphs
  return processTextParagraphs(
    paragraphs,
    safetyConfig.MAX_ITERATIONS,
    maxChunkSize,
  );
}
