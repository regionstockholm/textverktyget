import { initializeTextQualityEvaluation } from "../core/quality/quality-evaluation-client.js";
import {
  initializeCopyButton,
  initializePromptButton,
  initializeUpdateInfoButton,
  initializeWordModalButton,
} from "./components/action-buttons.js";
import { initializeTextCounters } from "./components/counter.js";
import {
  initializeCancelButton,
  initializeSummarizeButton,
} from "./components/processing-buttons.js";
import type { ProcessAttachedFiles } from "./components/processing-buttons.js";
import {
  initializeTaskCatalog,
  initializeTargetAudienceCatalog,
} from "./components/summarizer-form.js";
import { initializeTextProcessingUi } from "./components/text-processing-ui.js";
import { initializeWwwFetcherModal } from "./components/www-fetcher-modal.js";
import { initializeWordModal } from "./components/word-modal.js";
import { getById } from "./utils/dom.js";

export type SummarizerOptions = {
  processAttachedFiles?: ProcessAttachedFiles;
};

function initializeCatalogs(): void {
  void initializeTaskCatalog();
  void initializeTargetAudienceCatalog();
}

function initializeCounters(): void {
  const textInput = getById<HTMLTextAreaElement>("text-input");
  if (textInput) {
    initializeTextCounters(textInput, "char-count-input", "lix-count-input");
  }

  const summaryOutput = getById<HTMLTextAreaElement>("summary-output");
  if (summaryOutput) {
    initializeTextCounters(
      summaryOutput,
      "char-count-output",
      "lix-count-output",
    );
  }
}

function getSummaryOutputText(summaryOutput: HTMLTextAreaElement): string {
  return summaryOutput.value || summaryOutput.textContent || "";
}

function initializeOutputButtons(): void {
  const summaryOutput = getById<HTMLTextAreaElement>("summary-output");
  if (!summaryOutput) {
    return;
  }

  const copyButton = getById<HTMLButtonElement>("copy-text");
  if (copyButton) {
    initializeCopyButton(copyButton, () => getSummaryOutputText(summaryOutput));
  }

  const wordModalButton = getById<HTMLButtonElement>("copy-text-word");
  if (wordModalButton) {
    initializeWordModalButton(wordModalButton, () =>
      getSummaryOutputText(summaryOutput),
    );
  }
}

function initializePromptToggle(): void {
  const promptButton = getById<HTMLButtonElement>("prompt-button");
  const finalPrompt = getById<HTMLElement>("final-prompt");

  if (promptButton && finalPrompt) {
    initializePromptButton(promptButton, finalPrompt);
  }
}

function initializeProcessingControls(
  processAttachedFiles?: ProcessAttachedFiles,
): void {
  initializeSummarizeButton(
    "text-input",
    "summary-output",
    "summarize-button",
    processAttachedFiles,
  );
  initializeCancelButton("cancel-request");
}

export function initializeSummarizer(
  options: SummarizerOptions = {},
): void {
  initializeCatalogs();
  initializeTextProcessingUi();
  initializeTextQualityEvaluation();
  initializeWwwFetcherModal();
  initializeWordModal();
  initializeCounters();
  initializeOutputButtons();
  initializePromptToggle();
  initializeUpdateInfoButton();
  initializeProcessingControls(options.processAttachedFiles);
}
