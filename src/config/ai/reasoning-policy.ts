import type { ProcessingOptions } from "./ai-service-types.js";

/** Only explicitly marked task calls may override provider reasoning defaults. */
export function isTaskExecution(options?: ProcessingOptions): boolean {
  return (
    options?.aiCallPurpose === "task" &&
    options.taskPromptMode === undefined
  );
}

export function resolveGeminiThinkingBudget(
  model: string,
  providerThinking: boolean,
  defaultBudget: number | undefined,
  options?: ProcessingOptions,
): number | undefined {
  // The other currently whitelisted models (Gemini 1.5) do not support thinking.
  if (model.replace(/^models\//, "") !== "gemini-2.5-flash") {
    return undefined;
  }

  if (isTaskExecution(options)) {
    if (options?.reasoningEnabled === false) return 0;
    return defaultBudget !== undefined && defaultBudget !== 0
      ? defaultBudget
      : -1;
  }

  // Preserve the existing background-call configuration.
  return providerThinking ? (defaultBudget ?? -1) : undefined;
}

export function buildOpenAiGenerationParameters(
  options: ProcessingOptions,
  backgroundModel: string,
  taskModel: string,
  maxTokens: number,
) {
  if (isTaskExecution(options)) {
    return {
      model: taskModel,
      max_completion_tokens: maxTokens,
      reasoning_effort: options.reasoningEnabled === false ? "none" : "low",
    };
  }

  return {
    model: backgroundModel,
    max_tokens: maxTokens,
    temperature: 0.7,
  };
}
