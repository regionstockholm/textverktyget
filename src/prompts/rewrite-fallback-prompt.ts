import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getRewriteFallbackPrompt: Readonly<string> =
  getDefaultPrompts().rewriteFallback;
