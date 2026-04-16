import { getTextQualityPrompt } from "../prompts/quality-evaluation-prompt.js";

export interface QualityEvaluationContext {
  taskKey?: string;
  targetAudience?: string;
  taskOutputMode?: string;
}

function replacePlaceholder(
  template: string,
  placeholder: string,
  value: string,
): string {
  return template.split(placeholder).join(value);
}

function normalizeContextValue(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

/**
 * Prepares evaluation prompt with actual content.
 * Isolated from database/AI modules to keep prompt logic testable.
 */
export function prepareEvaluationPrompt(
  originalText: string,
  processedText: string,
  promptUsed: string,
  rewritePlanDraft?: string,
  promptTemplate?: string,
  senderIntent?: string,
  context?: QualityEvaluationContext,
): string {
  const template = promptTemplate || getTextQualityPrompt;
  let result = template;

  result = replacePlaceholder(result, "[Infoga Originaltext här]", originalText);
  result = replacePlaceholder(result, "[Infoga Prompt här]", promptUsed);
  result = replacePlaceholder(
    result,
    "[Infoga Omskrivningsutkast här]",
    rewritePlanDraft || "",
  );
  result = replacePlaceholder(
    result,
    "[Infoga Avsändarens intention här]",
    senderIntent || "",
  );
  result = replacePlaceholder(
    result,
    "[Infoga Bearbetad text här]",
    processedText,
  );
  result = replacePlaceholder(
    result,
    "[Infoga Task key här]",
    normalizeContextValue(context?.taskKey),
  );
  result = replacePlaceholder(
    result,
    "[Infoga Målgrupp här]",
    normalizeContextValue(context?.targetAudience),
  );
  result = replacePlaceholder(result, "[Infoga SummaryTextType här]", "");
  result = replacePlaceholder(
    result,
    "[Infoga TaskOutputMode här]",
    normalizeContextValue(context?.taskOutputMode),
  );

  return result;
}
