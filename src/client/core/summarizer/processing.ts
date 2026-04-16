/**
 * Text processing module for summarization
 * Handles text validation and form processing
 * @module summarizer/processing
 */

import { assert } from "../../safety/assertions.js";
import { FormValues } from "./interfaces.js";
import { MIN_TEXT_LENGTH } from "../../../config/shared-config.js";

/**
 * Selected task metadata from task catalog UI
 */
interface SelectedTaskValues {
  taskKey: string;
  targetAudienceEnabled: boolean;
}

/**
 * Gets selected task metadata from the checked task radio
 */
function getSelectedTaskValues(): SelectedTaskValues {
  const summaryTypeElement = document.querySelector(
    'input[name="summary-type"]:checked',
  ) as HTMLInputElement;
  assert(summaryTypeElement !== null, "No summary type selected");

  const taskKey =
    summaryTypeElement.dataset.taskKey || summaryTypeElement.value;
  const targetAudienceEnabled =
    summaryTypeElement.dataset.targetAudienceEnabled !== "false";

  return {
    taskKey,
    targetAudienceEnabled,
  };
}

/**
 * Gets the selected target audience
 * @returns Selected target audience
 */
function getTargetAudience(): string {
  const targetAudienceElement = document.getElementById(
    "target-audience",
  ) as HTMLSelectElement;
  assert(targetAudienceElement !== null, "Target audience element not found");
  return targetAudienceElement.value;
}

/**
 * Gets all selected checkboxes
 * @returns Array of selected checkbox values
 */
function getSelectedCheckboxes(): string[] {
  // Return an empty array since there are no checkboxes anymore
  return [];
}

/**
 * Gets the selected quality process option
 * @returns Whether quality process is selected (true) or fast process (false)
 * @note Quality evaluation is always enabled by default
 */
function getQualityProcess(): boolean {
  // Quality process is always enabled by default
  return true;
}

/**
 * Gets standard form values
 * @param taskValues - Selected task metadata
 * @returns Standard form values
 */
function getStandardFormValues(taskValues: SelectedTaskValues): FormValues {
  const selectedAudience = getTargetAudience();
  const targetAudience = taskValues.targetAudienceEnabled
    ? selectedAudience
    : selectedAudience || "Allman malgrupp";
  const checkboxContent = getSelectedCheckboxes();
  const qualityProcess = getQualityProcess();

  assert(targetAudience !== "", "Target audience is required");

  const values: FormValues = {
    taskKey: taskValues.taskKey,
    targetAudience,
    checkboxContent,
    qualityProcess,
  };

  return values;
}

/**
 * Gets all selected values from the form
 * @returns Selected form values
 */
export function getSelectedValues(): FormValues {
  const taskValues = getSelectedTaskValues();

  const values = getStandardFormValues(taskValues);

  console.log("Selected values:", values);
  return values;
}

/**
 * Validates the input text for summarization
 * @param text - The text to validate
 * @throws {Error} If validation fails
 */
export function validateSummaryInput(text: string): void {
  assert(typeof text === "string", "Text must be a string");
  assert(text.length > 0, "Text cannot be empty");
  assert(
    text.length >= MIN_TEXT_LENGTH,
    `Text is too short (${text.length} < ${MIN_TEXT_LENGTH})`,
  );
}

/**
 * Handles errors during summarization
 * @param error - The error that occurred
 * @param clickCount - The click count for logging
 */
export async function handleSummarizationError(
  error: Error,
  clickCount: number,
): Promise<void> {
  assert(error instanceof Error, "Error must be an Error object");
  assert(typeof clickCount === "number", "Click count must be a number");

  console.error(`Error during summarization (${clickCount}):`, error);

  let errorMessage = "Något gick fel, försök igen.";

  if (error.message.includes("Service Unavailable")) {
    errorMessage =
      "Servern är för tillfället överbelastad. Försök igen om en stund.";
  } else if (
    error.message.includes("timeout") ||
    error.message.includes("timed out")
  ) {
    errorMessage = "Bearbetningen tog för lång tid. Försök igen.";
  } else if (error.message.includes("Network")) {
    errorMessage = "Nätverksfel. Kontrollera din internetanslutning.";
  }

  try {
    const { showOutputErrorIndicator } =
      await import("../../ui/components/output-status.js");
    showOutputErrorIndicator(errorMessage, 5000);
  } catch (importError) {
    console.error(
      "Failed to import error indicator, falling back to alert:",
      importError,
    );
    alert(errorMessage);
  }
}
