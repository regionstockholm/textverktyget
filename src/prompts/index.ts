/**
 * Prompts index file
 * Exports all prompt functions from the prompts directory
 *
 * PROMPT DESIGN STRATEGY:
 * All prompts follow Google's Gemini prompt design guidelines:
 * - Clear and specific instructions
 * - Proper constraints and formatting
 * - Few-shot examples where appropriate
 * - Consistent structure across all prompts
 */

export { getRolePrompt } from "./role-prompt.js";
export { getImportantRulesPrompt } from "./important-rules-prompt.js";
export { getTaskPrompt } from "./task-prompt.js";
export { getTargetAudiencePrompt } from "./target-audience-prompt.js";
export { getTextQualityPrompt } from "./quality-evaluation-prompt.js";
export { getWordListUsagePrompt } from "./word-list-usage-prompt.js";
export { getRewriteFallbackPrompt } from "./rewrite-fallback-prompt.js";
