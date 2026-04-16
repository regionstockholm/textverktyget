/**
 * Rewrite plan draft generation handler.
 * Produces a compact Swedish draft used to guide the main rewrite step.
 */

import { assert } from "../../utils/safety-utils.js";
import { getSummary } from "./ai-service-factory.js";
import type { ProcessingOptions } from "./ai-service-types.js";

/**
 * Generates an internal rewrite plan draft in Swedish.
 * Falls back to empty string on AI failure so the main flow can continue.
 *
 * @param text - Original text
 * @param options - Current processing options
 * @returns Compact rewrite plan draft or empty string
 */
export async function generateRewritePlanDraft(
  text: string,
  options: ProcessingOptions,
): Promise<string> {
  assert(typeof text === "string", "Text must be a string");
  assert(text.trim().length > 0, "Text cannot be empty");
  assert(options !== undefined && options !== null, "Options are required");

  try {
    const planOptions: ProcessingOptions = {
      ...options,
      taskPromptMode: "rewritePlanDraft",
    };

    const result = await getSummary(text, planOptions);
    return (result.summary || "").trim();
  } catch (error) {
    console.warn(
      "[RewritePlan] Failed to generate rewrite plan draft, continuing without it:",
      error,
    );
    return "";
  }
}
