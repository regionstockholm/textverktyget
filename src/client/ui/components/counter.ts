/**
 * Text analysis module for counting characters and calculating readability metrics
 * @module textCounter
 */

// Import safety utilities for Power of Ten compliance
import { safeIterate } from "../../safety/assertions.js";
import { safetyConfig } from "../../../config/shared-config.js";

/**
 * Interface for text analysis results
 */
export interface TextAnalysisResult {
  characterCount: number;
  lixScore: number;
  wordCount: number;
  sentenceCount: number;
  longWordCount: number;
}

/**
 * Initializes text counters for character count and LIX score
 * Sets up event listeners to update counts when text changes
 *
 * @param inputElement - The input element to monitor for text changes
 * @param charOutputElementId - ID of element to display character count
 * @param lixOutputElementId - ID of element to display LIX score
 * @returns boolean indicating success or failure
 */
export const initializeTextCounters = (
  inputElement: HTMLElement | HTMLTextAreaElement | HTMLInputElement,
  charOutputElementId: string,
  lixOutputElementId: string,
): boolean => {
  // Validate input parameters
  if (
    !validateCounterInputs(
      inputElement,
      charOutputElementId,
      lixOutputElementId,
    )
  ) {
    return false;
  }

  try {
    // Create update function to recalculate metrics when text changes
    const updateCounts = createUpdateFunction(
      inputElement,
      charOutputElementId,
      lixOutputElementId,
    );

    // Set up event listeners
    if (inputElement) {
      inputElement.addEventListener("input", updateCounts);
      inputElement.addEventListener("change", updateCounts);
    }

    // Initial update
    updateCounts();
    return true;
  } catch (error) {
    console.error(
      "Error initializing text counters:",
      (error as Error).message,
    );
    return false;
  }
};

/**
 * Validates inputs for the counter initialization
 *
 * @param inputElement - The input element to validate
 * @param charOutputElementId - ID for character count display
 * @param lixOutputElementId - ID for LIX score display
 * @returns boolean indicating if inputs are valid
 */
const validateCounterInputs = (
  inputElement: HTMLElement | HTMLTextAreaElement | HTMLInputElement,
  charOutputElementId: string,
  lixOutputElementId: string,
): boolean => {
  if (!inputElement) {
    console.error("inputElement must not be null or undefined");
    return false;
  }

  if (!(inputElement instanceof Element)) {
    console.error("inputElement must be a DOM element");
    return false;
  }

  if (
    !charOutputElementId ||
    typeof charOutputElementId !== "string" ||
    charOutputElementId.trim() === ""
  ) {
    console.error("charOutputElementId must be a non-empty string");
    return false;
  }

  if (
    !lixOutputElementId ||
    typeof lixOutputElementId !== "string" ||
    lixOutputElementId.trim() === ""
  ) {
    console.error("lixOutputElementId must be a non-empty string");
    return false;
  }

  return true;
};

/**
 * Creates a function that updates text metrics display elements
 *
 * @param inputElement - Element containing the text to analyze
 * @param charOutputElementId - ID of character count display element
 * @param lixOutputElementId - ID of LIX score display element
 * @returns Function that updates the display elements
 */
const createUpdateFunction = (
  inputElement: HTMLElement | HTMLTextAreaElement | HTMLInputElement,
  charOutputElementId: string,
  lixOutputElementId: string,
): (() => void) => {
  return (): void => {
    try {
      if (!inputElement) return;

      // Extract text from the input element
      const text = getElementText(inputElement);

      // Analyze the text (no truncation needed)
      const analysis = analyzeText(text);

      // Update display elements
      updateDisplayElements(
        charOutputElementId,
        lixOutputElementId,
        analysis.characterCount,
        analysis.lixScore,
      );
    } catch (error) {
      console.error("Error updating counts:", (error as Error).message);
    }
  };
};

/**
 * Gets text content from an element
 *
 * @param element - Element to extract text from
 * @returns The text content
 */
const getElementText = (
  element: HTMLElement | HTMLTextAreaElement | HTMLInputElement,
): string => {
  return "value" in element
    ? (element as HTMLInputElement | HTMLTextAreaElement).value
    : element.textContent || "";
};

/**
 * Formats large numbers with thousand separators
 * @param num - Number to format
 * @returns Formatted number string
 */
const formatNumber = (num: number): string => {
  return num.toLocaleString("sv-SE");
};

/**
 * Updates the display elements with new count values
 *
 * @param charOutputElementId - ID for character count element
 * @param lixOutputElementId - ID for LIX score element
 * @param charCount - Character count to display
 * @param lixScore - LIX score to display
 */
const updateDisplayElements = (
  charOutputElementId: string,
  lixOutputElementId: string,
  charCount: number,
  lixScore: number,
): void => {
  const charOutputElement = document.getElementById(charOutputElementId);
  const lixOutputElement = document.getElementById(lixOutputElementId);

  if (charOutputElement) {
    charOutputElement.textContent = formatNumber(charCount);
  } else {
    console.warn(`Element with ID ${charOutputElementId} not found`);
  }

  if (lixOutputElement) {
    lixOutputElement.textContent = `${lixScore}`;
  } else {
    console.warn(`Element with ID ${lixOutputElementId} not found`);
  }
};

/**
 * Analyzes text to compute various metrics
 *
 * @param text - Text to analyze
 * @returns Object with analysis results
 */
export const analyzeText = (text: string): TextAnalysisResult => {
  return {
    characterCount: text.length,
    lixScore: calculateLIX(text),
    wordCount: countWords(text),
    sentenceCount: countSentences(text),
    longWordCount: countLongWords(text),
  };
};

/**
 * Counts words in text
 *
 * @param text - Text to analyze
 * @returns Number of words
 */
const countWords = (text: string): number => {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return 0;
  }

  // Clean the text and split into words
  const cleanText = text
    .replace(/[^a-zA-Z0-9åäöÅÄÖ.!?]+/g, " ")
    .replace(/\s+/g, " ");
  const words = cleanText
    .split(" ")
    .filter((word) => /^[a-zA-ZåäöÅÄÖ]+$/.test(word));

  // Enforce safety limits
  return Math.min(words.length, safetyConfig.MAX_ITERATIONS);
};

/**
 * Counts sentences in text
 *
 * @param text - Text to analyze
 * @returns Number of sentences
 */
const countSentences = (text: string): number => {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return 0;
  }

  // Count sentence ending punctuation
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;

  // If there's text but no sentence endings, assume one sentence
  return Math.max(sentenceCount, text.trim().length > 0 ? 1 : 0);
};

/**
 * Counts long words (more than 6 characters) in text
 *
 * @param text - Text to analyze
 * @returns Number of long words
 */
const countLongWords = (text: string): number => {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return 0;
  }

  // Clean the text and split into words
  const cleanText = text
    .replace(/[^a-zA-Z0-9åäöÅÄÖ.!?]+/g, " ")
    .replace(/\s+/g, " ");
  const words = cleanText
    .split(" ")
    .filter((word) => /^[a-zA-ZåäöÅÄÖ]+$/.test(word));

  // Enforce safety limits
  const safeWords =
    words.length <= safetyConfig.MAX_ITERATIONS
      ? words
      : words.slice(0, safetyConfig.MAX_ITERATIONS);

  // Count long words
  let longWordCount = 0;
  safeIterate(safeWords, (word) => {
    if (word && word.length > 6) {
      longWordCount++;
    }
  });

  return longWordCount;
};

/**
 * Calculates the LIX (Läsbarhetsindex) readability score for a text
 * LIX is a readability measure commonly used for Swedish texts
 *
 * Formula: LIX = (number of words / number of sentences) + (number of long words * 100 / number of words)
 * Where long words are defined as words with more than 6 characters
 *
 * @param text - The text to analyze
 * @returns The calculated LIX score, or 0 if text is empty/invalid
 */
const calculateLIX = (text: string): number => {
  try {
    // Validate input
    if (!text || typeof text !== "string") {
      return 0;
    }

    // Trim and check if empty
    text = text.trim();
    if (text.length === 0) {
      return 0;
    }

    // Get word, sentence and long word counts
    const wordCount = countWords(text);
    if (wordCount === 0) {
      return 0;
    }

    const sentenceCount = countSentences(text);
    const effectiveSentenceCount = Math.max(sentenceCount, 1);

    const longWordCount = countLongWords(text);

    // Calculate LIX score
    const wordsPerSentence = wordCount / effectiveSentenceCount;
    const longWordsPercentage = (longWordCount * 100) / wordCount;

    return Math.round(wordsPerSentence + longWordsPercentage);
  } catch (error) {
    console.error("Error calculating LIX:", (error as Error).message);
    return 0;
  }
};
