import {
  AI_CONFIG,
  DEFAULT_PROVIDER,
  type AIProvider,
  type AIProviderConfig,
} from "./ai-config.js";

function resolveProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER as AIProvider | undefined;
  return provider && provider in AI_CONFIG ? provider : DEFAULT_PROVIDER;
}

export function getCurrentAIConfig(): AIProviderConfig {
  return AI_CONFIG[resolveProvider()];
}

export function validateChunkParameters(
  text: string,
  maxChunkSize: number,
): boolean {
  return (
    typeof text === "string" &&
    text.length > 0 &&
    typeof maxChunkSize === "number" &&
    Number.isFinite(maxChunkSize) &&
    maxChunkSize > 0
  );
}

export function splitTextIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function splitParagraphIntoSentenceGroups(
  paragraph: string,
  maxChunkSize: number,
): string[] {
  const sentences = paragraph
    .split(/[.!?]+\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const groups: string[] = [];
  let currentGroup = "";

  for (const sentence of sentences) {
    if (
      currentGroup.length > 0 &&
      currentGroup.length + sentence.length + 1 > maxChunkSize
    ) {
      groups.push(currentGroup);
      currentGroup = sentence;
      continue;
    }

    currentGroup += (currentGroup ? " " : "") + sentence;
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups.length > 0 ? groups : [paragraph];
}

export function processParagraphBySentences(
  paragraph: string,
  chunks: string[],
  maxChunkSize: number,
): void {
  for (const sentenceGroup of splitParagraphIntoSentenceGroups(
    paragraph,
    maxChunkSize,
  )) {
    addParagraphToChunk(
      sentenceGroup,
      chunks[chunks.length - 1] || "",
      chunks,
      maxChunkSize,
    );
  }
}

export function addParagraphToChunk(
  paragraph: string,
  currentChunk: string,
  chunks: string[],
  maxChunkSize: number,
): void {
  if (paragraph.length > maxChunkSize) {
    processParagraphBySentences(paragraph, chunks, maxChunkSize);
    return;
  }

  if (currentChunk.length > 0) {
    const combinedChunk = `${currentChunk}\n\n${paragraph}`;
    if (combinedChunk.length <= maxChunkSize) {
      chunks[chunks.length - 1] = combinedChunk;
      return;
    }
  }

  chunks.push(paragraph);
}

export function processTextParagraphs(
  paragraphs: string[],
  maxParagraphs: number,
  maxChunkSize: number,
): string[] {
  const chunks: string[] = [];

  for (const paragraph of paragraphs.slice(0, maxParagraphs)) {
    addParagraphToChunk(
      paragraph,
      chunks[chunks.length - 1] || "",
      chunks,
      maxChunkSize,
    );
  }

  return chunks;
}

export function chunkText(
  text: string,
  maxChunkSize: number = getCurrentAIConfig().MAX_CHUNK_SIZE,
): string[] {
  if (!validateChunkParameters(text, maxChunkSize)) {
    throw new Error("Invalid text chunking parameters");
  }

  if (text.length <= maxChunkSize) {
    return [text];
  }

  const paragraphs = splitTextIntoParagraphs(text);
  return processTextParagraphs(paragraphs, paragraphs.length, maxChunkSize);
}
