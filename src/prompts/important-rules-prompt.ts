/**
 * Important rules prompt for Region Stockholm text processing
 * Contains guidelines for clear language and Region Stockholm's writing rules
 *
 * PROMPT DESIGN STRATEGY:
 * - Clear instructions with numbered constraints
 * - Examples to demonstrate application of the rules
 * - Consistent formatting with other prompts
 * - Breaks down complex instructions into categories
 */

import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getImportantRulesPrompt: Readonly<string> =
  getDefaultPrompts().importantRules;
