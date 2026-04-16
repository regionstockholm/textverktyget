import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getWordListUsagePrompt: Readonly<string> =
  getDefaultPrompts().wordListUsage;
