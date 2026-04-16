/**
 * API communication module for text summarization
 * Handles API requests and response processing
 * Follows Power of Ten guidelines for TypeScript
 * @module summarizer/api
 */

import { assert } from "../../safety/assertions.js";
import { FormValues, SummarizationResponse } from "./interfaces.js";

export interface SummarizeProgressResponse {
  processId: string;
  stage: string;
  message: string;
  updatedAt: string;
  isTerminal: boolean;
}

export interface SummarizeProgressPollResult {
  progress: SummarizeProgressResponse | null;
  rateLimited: boolean;
}

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

export async function fetchSummarizationProgress(
  processId: string,
  abortSignal?: AbortSignal,
): Promise<SummarizeProgressPollResult> {
  assert(typeof processId === "string" && processId.trim().length > 0, "Process ID is required");

  try {
    const response = await fetch(
      `/api/summarize-progress/${encodeURIComponent(processId)}?ts=${Date.now()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: abortSignal,
      },
    );

    if (!response.ok) {
      console.debug(
        `[SummarizeProgress] Poll failed with status ${response.status} for ${processId}`,
      );
      if (response.status === 429) {
        return { progress: null, rateLimited: true };
      }
      if (response.status === 404) {
        return { progress: null, rateLimited: false };
      }
      return { progress: null, rateLimited: false };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: SummarizeProgressResponse;
    };

    if (!payload.success || !payload.data) {
      return { progress: null, rateLimited: false };
    }

    return { progress: payload.data, rateLimited: false };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { progress: null, rateLimited: false };
    }
    return { progress: null, rateLimited: false };
  }
}

/**
 * Evaluates the quality of processed text by sending a request to the quality evaluation endpoint
 * @param recordId - The ID of the quality record to evaluate
 * @param attemptNumber - The current attempt number
 * @param abortSignal - Optional abort signal for cancelling the request
 * @returns Promise resolving to the quality evaluation result
 */
export async function evaluateTextQuality(
  recordId: number,
  attemptNumber: number = 1,
  abortSignal?: AbortSignal,
): Promise<{ score: number; needsResubmission: boolean }> {
  assert(recordId > 0, "Record ID is required");
  assert(typeof attemptNumber === "number", "Attempt number must be a number");

  const startTime = Date.now();
  console.log(
    `[Quality API Client] Evaluating record ${recordId} (attempt ${attemptNumber})`,
  );
  console.log(
    `Abort signal provided: ${abortSignal ? "YES" : "NO"} (Record ID: ${recordId})`,
  );

  try {
    const requestBody = { recordId };

    // Send request to quality evaluation endpoint with abort signal
    const response = await fetch("/api/quality/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Quality API Client] API error response:`, errorText);
      throw new Error(
        `Quality evaluation failed with status ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json();

    // Extract the actual data from the success wrapper
    const actualData = data.success ? data.data : data;

    // Validate response data
    if (typeof actualData.score !== "number") {
      console.error(
        `[Quality API Client] Invalid score type: ${typeof actualData.score}`,
      );
      throw new Error(
        `Invalid score received: expected number, got ${typeof actualData.score}`,
      );
    }

    if (typeof actualData.needsResubmission !== "boolean") {
      console.error(
        `[Quality API Client] Invalid needsResubmission type: ${typeof actualData.needsResubmission}`,
      );
      throw new Error(
        `Invalid needsResubmission flag: expected boolean, got ${typeof actualData.needsResubmission}`,
      );
    }

    console.log(
      `[Quality API Client] Record ${recordId}: score ${actualData.score}, resubmit: ${actualData.needsResubmission} (${responseTime}ms)`,
    );

    return {
      score: actualData.score,
      needsResubmission: actualData.needsResubmission,
    };
  } catch (error) {
    // Check if this is an abort error
    if (error instanceof Error && error.name === "AbortError") {
      console.log(`Quality evaluation was cancelled (Record ID: ${recordId})`);
      throw new Error("Quality evaluation cancelled by user");
    }

    const responseTime = Date.now() - startTime;
    console.error(`[Quality API Client] Error after ${responseTime}ms:`, error);
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

    // Directly set the prompt-output textarea value
    const promptOutput = document.getElementById(
      "prompt-output",
    ) as HTMLTextAreaElement;
    if (promptOutput) {
      console.log(
        `[DEBUG] Setting prompt-output directly (Request ID: ${requestId})`,
      );
      promptOutput.value = data.systemMessage.trim();
      promptOutput.dispatchEvent(new Event("input"));
      console.log(
        `[DEBUG] Prompt-output value set directly (Request ID: ${requestId})`,
      );
    } else {
      console.error(
        `[DEBUG] Prompt-output element not found for direct setting (Request ID: ${requestId})`,
      );
    }
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
