/**
 * Text summarization core functionality
 * Contains core summarization logic and initialization
 * Follows Power of Ten guidelines for TypeScript
 * @module summarizer/core
 */

import { assert } from "../../safety/assertions.js";
import { FormValues, SummarizationResponse } from "./interfaces.js";
import { validateSummaryInput, getSelectedValues } from "./processing.js";
import {
  sendSummarizationRequest,
  processSummarizationResponse,
} from "./api.js";

/**
 * Retrieves a summary of the provided text by sending chunks to the server
 * Handles request tracking, error handling, and API communication
 *
 * @param text - The text to be summarized
 * @param customFormValues - Optional custom form values to use instead of reading from the form
 * @param abortSignal - Optional abort signal for cancelling the request
 * @returns Promise resolving to the summary response data
 * @throws {Error} If API request fails or returns error status
 */
export async function getSummary(
  text: string,
  customFormValues?: FormValues,
  abortSignal?: AbortSignal
): Promise<SummarizationResponse> {
  // Validate input
  validateSummaryInput(text);

  // Generate request ID locally instead of using global variable
  // Following Rule 6: Data objects must be declared at the smallest possible level of scope
  const currentRequestId = Date.now() + Math.floor(Math.random() * 1000);

  console.log(
    `getSummary called with text length: ${text.length} (Request ID: ${currentRequestId})`
  );
  console.log(`Abort signal available: ${abortSignal ? 'YES' : 'NO'} (Request ID: ${currentRequestId})`);

  try {
    // Get form values and validate
    const formValues = customFormValues || getSelectedValues();

    assert(
      formValues !== null && formValues !== undefined,
      "Form values are required"
    );

    // Send request to server with abort signal
    const response = await sendSummarizationRequest(
      text,
      formValues,
      currentRequestId,
      abortSignal
    );

    // Process and validate response
    const result = await processSummarizationResponse(
      response,
      currentRequestId
    );

    console.log(
      `[getSummary] Response processed (Request ID: ${currentRequestId}): quality score ${result.qualityScore}, resubmit: ${result.needsResubmission}`
    );

    return result;
  } catch (error) {
    console.error(
      `Error in getSummary (Request ID: ${currentRequestId}):`,
      error
    );
    throw error;
  }
}
