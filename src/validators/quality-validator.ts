/**
 * Quality Validator
 * Validates quality evaluation requests
 *
 * @module validators/qualityValidator
 */

/**
 * Validates a quality evaluation request
 * @param body - Request body
 * @returns Validated request data
 * @throws Error if validation fails
 */
export function validateQualityEvaluationRequest(body: any): {
  recordId: number;
} {
  // Check if recordId exists and is a number
  if (!body.recordId) {
    throw new Error("Record ID is required");
  }

  const recordId = parseInt(body.recordId, 10);
  if (isNaN(recordId) || recordId <= 0) {
    throw new Error("Invalid record ID");
  }

  return { recordId };
}
