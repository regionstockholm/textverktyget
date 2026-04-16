export interface EasyToReadLayoutOptions {
  enabled: boolean;
  maxLineChars: number;
  maxLinesPerParagraph: number;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitSentences(paragraph: string): string[] {
  const normalized = paragraph.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/g);
  if (!sentences || sentences.length === 0) {
    return [normalized];
  }

  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

function wrapLineByWords(text: string, maxLineChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= maxLineChars) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function isBulletLine(line: string): boolean {
  return /^[-*•]\s+/.test(line.trim());
}

function isLikelyHeading(paragraph: string): boolean {
  const normalized = paragraph.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  if (/[.!?:]$/.test(normalized)) {
    return false;
  }

  const words = normalized.split(" ").filter(Boolean);
  return words.length > 0 && words.length <= 8;
}

function splitByMaxLines(lines: string[], maxLinesPerParagraph: number): string[] {
  if (lines.length <= maxLinesPerParagraph) {
    return [lines.join("\n")];
  }

  const blocks: string[] = [];
  for (let index = 0; index < lines.length; index += maxLinesPerParagraph) {
    blocks.push(lines.slice(index, index + maxLinesPerParagraph).join("\n"));
  }

  return blocks;
}

function formatBulletParagraph(
  paragraph: string,
  maxLineChars: number,
): string[] {
  const inputLines = paragraph
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const items: string[] = [];

  for (const line of inputLines) {
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const bulletContent = bulletMatch[1] || "";
      items.push(bulletContent.trim());
      continue;
    }

    if (items.length === 0) {
      items.push(line);
      continue;
    }

    const lastIndex = items.length - 1;
    const previous = items[lastIndex];
    if (typeof previous === "string") {
      items[lastIndex] = `${previous} ${line}`.trim();
    }
  }

  const formattedLines: string[] = [];
  const wrappedWidth = Math.max(10, maxLineChars - 2);
  for (const item of items) {
    const wrapped = wrapLineByWords(item, wrappedWidth);
    wrapped.forEach((line, index) => {
      formattedLines.push(index === 0 ? `- ${line}` : `  ${line}`);
    });
  }

  return formattedLines.length > 0 ? [formattedLines.join("\n")] : [];
}

export function formatEasyToReadLayout(
  text: string,
  options: EasyToReadLayoutOptions,
): string {
  if (!options.enabled) {
    return text;
  }

  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return normalized;
  }

  const maxLineChars = Math.min(80, Math.max(20, Math.trunc(options.maxLineChars)));
  const maxLinesPerParagraph = Math.min(
    8,
    Math.max(2, Math.trunc(options.maxLinesPerParagraph)),
  );

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const formattedParagraphs: string[] = [];

  for (const paragraph of paragraphs) {
    if (isBulletLine(paragraph)) {
      formattedParagraphs.push(...formatBulletParagraph(paragraph, maxLineChars));
      continue;
    }

    if (isLikelyHeading(paragraph) && paragraph.length <= maxLineChars) {
      formattedParagraphs.push(paragraph.replace(/\s+/g, " "));
      continue;
    }

    const plainParagraph = paragraph.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
    const sentences = splitSentences(plainParagraph);
    const wrappedLines = sentences.flatMap((sentence) =>
      wrapLineByWords(sentence, maxLineChars),
    );

    if (wrappedLines.length === 0) {
      continue;
    }

    formattedParagraphs.push(
      ...splitByMaxLines(wrappedLines, maxLinesPerParagraph),
    );
  }

  return formattedParagraphs.join("\n\n").trim();
}
