export type TextAnalysisResult = {
  characterCount: number;
  lixScore: number;
  wordCount: number;
  sentenceCount: number;
  longWordCount: number;
};

type TextSourceElement = HTMLElement | HTMLTextAreaElement | HTMLInputElement;

const WORD_PATTERN = /^[a-zA-ZåäöÅÄÖ]+$/;

function isTextSourceElement(element: unknown): element is TextSourceElement {
  return element instanceof Element;
}

function isNonEmptyId(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function getElementText(element: TextSourceElement): string {
  return "value" in element ? element.value : element.textContent || "";
}

function getWords(text: string): string[] {
  if (!text.trim()) {
    return [];
  }

  return text
    .replace(/[^a-zA-Z0-9åäöÅÄÖ.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((word) => WORD_PATTERN.test(word));
}

function formatNumber(value: number): string {
  return value.toLocaleString("sv-SE");
}

function updateDisplayElements(
  charOutputElementId: string,
  lixOutputElementId: string,
  charCount: number,
  lixScore: number,
): void {
  const charOutputElement = document.getElementById(charOutputElementId);
  const lixOutputElement = document.getElementById(lixOutputElementId);

  if (charOutputElement) {
    charOutputElement.textContent = formatNumber(charCount);
  }

  if (lixOutputElement) {
    lixOutputElement.textContent = String(lixScore);
  }
}

function countWords(text: string): number {
  return getWords(text).length;
}

function countSentences(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  const sentenceCount = (text.match(/[.!?]+/g) || []).length;
  return Math.max(sentenceCount, 1);
}

function countLongWords(text: string): number {
  return getWords(text).filter((word) => word.length > 6).length;
}

function calculateLIX(text: string): number {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return 0;
  }

  const wordCount = countWords(trimmedText);
  if (wordCount === 0) {
    return 0;
  }

  const sentenceCount = Math.max(countSentences(trimmedText), 1);
  const longWordCount = countLongWords(trimmedText);
  const wordsPerSentence = wordCount / sentenceCount;
  const longWordsPercentage = (longWordCount * 100) / wordCount;

  return Math.round(wordsPerSentence + longWordsPercentage);
}

export function analyzeText(text: string): TextAnalysisResult {
  return {
    characterCount: text.length,
    lixScore: calculateLIX(text),
    wordCount: countWords(text),
    sentenceCount: countSentences(text),
    longWordCount: countLongWords(text),
  };
}

export function initializeTextCounters(
  inputElement: TextSourceElement,
  charOutputElementId: string,
  lixOutputElementId: string,
): boolean {
  if (
    !isTextSourceElement(inputElement) ||
    !isNonEmptyId(charOutputElementId) ||
    !isNonEmptyId(lixOutputElementId)
  ) {
    return false;
  }

  const updateCounts = () => {
    const analysis = analyzeText(getElementText(inputElement));
    updateDisplayElements(
      charOutputElementId,
      lixOutputElementId,
      analysis.characterCount,
      analysis.lixScore,
    );
  };

  inputElement.addEventListener("input", updateCounts);
  inputElement.addEventListener("change", updateCounts);
  updateCounts();

  return true;
}
