/**
 * Sender intent prompt for Region Stockholm text processing.
 * Defines why texts are rewritten and what sender intent should guide prioritization.
 */

import { getDefaultPrompts } from "./default-prompts-loader.js";

export const getSenderIntentPrompt: Readonly<string> =
  getDefaultPrompts().senderIntent;
