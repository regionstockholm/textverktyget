import { getDefaultPrompts } from "./default-prompts-loader.js";

export function getTaskPrompt(taskKey?: string): string {
  const prompts = getDefaultPrompts().task;

  if (taskKey && typeof prompts[taskKey] === "string") {
    return prompts[taskKey];
  }

  const fallbackPrompt = Object.values(prompts).find(
    (prompt) => typeof prompt === "string" && prompt.length > 0,
  );
  if (!fallbackPrompt) {
    throw new Error("Missing default task prompt.");
  }

  return fallbackPrompt;
}
