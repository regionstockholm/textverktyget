/**
 * API communication module for text summarization
 * Handles API requests and response processing
 * @module summarizer/api
 */

import { assert } from "../../safety/assertions.js";
import type { FormValues, SummarizationResponse } from "./interfaces.js";

/**
 * Sends a summarization request to the server
 * @param text - The text to summarize
 * @param formValues - The form values
 * @param requestId - The request ID for logging
 * @param abortSignal - Optional abort signal for cancelling the request
 * @returns Promise resolving to the fetch response
 * @throws {Error} If the request fails
 */
export async function sendSummarizationRequest(
  text: string,
  formValues: FormValues,
  requestId: number,
  abortSignal?: AbortSignal,
): Promise<Response> {
  assert(text !== null && text !== undefined, "Text is required");
  assert(
    formValues !== null && formValues !== undefined,
    "Form values are required",
  );
  assert(requestId > 0, "Request ID is required");

  console.log(`Sending summarization request (Request ID: ${requestId})`);
  console.log(`Text length: ${text.length} (Request ID: ${requestId})`);
  console.log(
    `Abort signal provided: ${abortSignal ? "YES" : "NO"} (Request ID: ${requestId})`,
  );

  try {
    // Prepare request body
    const requestBody = {
      text: text,
      taskKey: formValues.taskKey,
      processId: formValues.processId,
      targetAudience: formValues.targetAudience,
      checkboxContent: formValues.checkboxContent,
      qualityProcess: formValues.qualityProcess,
      attemptNumber: formValues.attemptNumber || 1,
      previousQualityId: formValues.previousQualityId || 0,
    };

    console.log(`Request body prepared (Request ID: ${requestId})`);

    // Send request using regular fetch with abort signal
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    console.log(`Response received (Request ID: ${requestId})`);
    console.log(
      `Response status: ${response.status} (Request ID: ${requestId})`,
    );

    // Check response status
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`API error (Request ID: ${requestId}):`, errorData);
      throw new Error(
        errorData.message ||
          `API error: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  } catch (error) {
    // Check if this is an abort error
    if (error instanceof Error && error.name === "AbortError") {
      console.log(`Request was cancelled (Request ID: ${requestId})`);
      throw new Error("Request cancelled by user");
    }

    console.error(
      `Error sending summarization request (Request ID: ${requestId}):`,
      error,
    );
    throw error;
  }
}

/**
 * Processes the summarization response and updates the UI
 * @param response - The response from the summarization API
 * @param requestId - The request ID for tracking
 * @returns Promise resolving to the summarization response data
 */
export async function processSummarizationResponse(
  response: Response,
  requestId: number,
): Promise<SummarizationResponse> {
  assert(response !== null && response !== undefined, "Response is required");
  assert(requestId > 0, "Request ID is required");

  const response_json = await response.json();
  console.log(
    `Received response from /api/summarize (Request ID: ${requestId})`,
  );
  console.log(
    `[DEBUG] Raw response data (Request ID: ${requestId}):`,
    response_json,
  );

  // Unwrap the response data (API wraps in { success: true, data: {...} })
  const data = response_json.data || response_json;

  // Validate response data
  assert(data !== null && data !== undefined, "Response data is required");
  assert(typeof data.summary === "string", "Summary must be a string");
  assert(data.summary.length > 0, "Summary cannot be empty");

  // Validate system message if it exists
  if (data.systemMessage) {
    console.log(
      `[DEBUG] System message found in response (Request ID: ${requestId})`,
    );
    console.log(
      `[DEBUG] System message length: ${data.systemMessage.length} (Request ID: ${requestId})`,
    );
    console.log(
      `[DEBUG] System message preview: ${data.systemMessage.substring(
        0,
        50,
      )}... (Request ID: ${requestId})`,
    );

    assert(
      typeof data.systemMessage === "string",
      "System message must be a string",
    );
  } else {
    console.warn(
      `[DEBUG] No system message in response (Request ID: ${requestId})`,
    );
  }

  // Quality evaluation is handled server-side, just log the results
  if (data.qualityEvaluationId) {
    console.log(
      `[API] Quality evaluation ID: ${data.qualityEvaluationId} (Request ID: ${requestId})`,
    );

    if (data.qualityScore !== undefined) {
      console.log(
        `[API] Server-side quality evaluation complete: Score ${data.qualityScore}, Resubmit: ${data.needsResubmission} (Request ID: ${requestId})`,
      );
    } else {
      console.log(
        `[API] Server-side quality evaluation incomplete, displaying text anyway (Request ID: ${requestId})`,
      );
      // Set default values for incomplete quality evaluation
      data.qualityScore = undefined;
      data.needsResubmission = false;
    }
  }

  return data as SummarizationResponse;
}
