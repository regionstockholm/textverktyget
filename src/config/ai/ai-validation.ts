/**
 * AI Request Validation Module
 * Provides functionality for validating requests to AI services
 * @module config/ai/validation
 */

/**
 * Interface for validation result
 * @interface ValidationResult
 */
export interface ValidationResult {
  valid: boolean;
  status: number;
  error?: string;
  message?: string;
}

/**
 * Validates summarize request
 *
 * @param {Object} body - Request body
 * @returns {ValidationResult} Validation result
 */
export function validateSummarizeRequest(body: any): ValidationResult {
  // Assert preconditions
  if (!body) {
    return {
      valid: false,
      status: 400,
      error: "Missing request body",
      message: "Begäran saknar data. Vänligen försök igen.",
    };
  }

  // Validate text
  if (!body.text) {
    return {
      valid: false,
      status: 400,
      error: "Missing text",
      message: "Ingen text att bearbeta. Vänligen ange text.",
    };
  }

  if (typeof body.text !== "string") {
    return {
      valid: false,
      status: 400,
      error: "Text must be a string",
      message: "Texten måste vara en sträng.",
    };
  }

  if (body.text.trim().length === 0) {
    return {
      valid: false,
      status: 400,
      error: "Text cannot be empty",
      message: "Texten kan inte vara tom.",
    };
  }

  const hasTaskKey =
    typeof body.taskKey === "string" && body.taskKey.trim().length > 0;

  if (!hasTaskKey) {
    return {
      valid: false,
      status: 400,
      error: "Missing taskKey",
      message: "Vänligen välj en uppgift.",
    };
  }

  // Validate target audience when sent
  if (body.targetAudience !== undefined && typeof body.targetAudience !== "string") {
    return {
      valid: false,
      status: 400,
      error: "Invalid target audience",
      message: "Ogiltig målgrupp.",
    };
  }

  // Validate checkbox content
  if (!body.checkboxContent) {
    return {
      valid: false,
      status: 400,
      error: "Missing checkbox content",
      message: "Vänligen välj minst ett alternativ.",
    };
  }

  // Ensure checkboxContent is an array
  if (
    !Array.isArray(body.checkboxContent) &&
    typeof body.checkboxContent !== "string"
  ) {
    return {
      valid: false,
      status: 400,
      error: "Invalid checkbox content format",
      message: "Ogiltigt format för valda alternativ.",
    };
  }

  return {
    valid: true,
    status: 200,
  };
}
