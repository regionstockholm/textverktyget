/**
 * Role prompt for Region Stockholm text assistant
 * Defines the role and responsibilities of the text assistant
 *
 * PROMPT DESIGN STRATEGY:
 * - Clear and specific instructions for the AI's role
 * - Constraints on writing style and output
 * - Consistent formatting with other prompts
 */

import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getRolePrompt: Readonly<string> = getDefaultPrompts().role;
