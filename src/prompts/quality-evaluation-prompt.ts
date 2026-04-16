/**
 * Text quality prompt for Region Stockholm text processing
 * Contains information about text quality evaluation
 *
 * PROMPT DESIGN STRATEGY:
 * - Clear role and task definition
 * - Structured input format with examples
 * - Specific constraints on evaluation criteria
 * - Explicit response format guidelines
 */

import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getTextQualityPrompt: Readonly<string> =
  getDefaultPrompts().qualityEvaluation;
