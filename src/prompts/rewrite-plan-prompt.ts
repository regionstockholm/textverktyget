/**
 * Prompt for generating a rewrite plan draft in Swedish.
 * The output is used as an internal guide before the main rewrite step.
 */
import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getRewritePlanPrompt: Readonly<string> =
  getDefaultPrompts().rewritePlan;
