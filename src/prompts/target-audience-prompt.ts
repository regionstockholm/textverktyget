import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getTargetAudiencePrompt = (targetAudience: string): string => {
  const defaults = getDefaultPrompts().targetAudience;
  const knownPrompt = defaults.known[targetAudience];

  if (knownPrompt) {
    return knownPrompt;
  }

  return defaults.fallbackTemplate.replace(/\{targetAudience\}/g, targetAudience);
};
