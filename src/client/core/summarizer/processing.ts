import { fileLimits } from "../../../config/shared-config.js";
import { assert } from "../../safety/assertions.js";

export function validateSummaryInput(text: string): void {
  assert(typeof text === "string", "Text must be a string");
  assert(text.length > 0, "Text cannot be empty");
  assert(
    text.length >= fileLimits.minTextLength,
    `Text is too short (${text.length} < ${fileLimits.minTextLength})`,
  );
}

export function getSummarizationErrorMessage(error: Error): string {
  if (error.message.includes("Service Unavailable")) {
    return "Servern är för tillfället överbelastad. Försök igen om en stund.";
  }

  if (
    error.message.includes("timeout") ||
    error.message.includes("timed out")
  ) {
    return "Bearbetningen tog för lång tid. Försök igen.";
  }

  if (
    error.name === "AbortError" ||
    error.message.includes("cancelled") ||
    error.message.includes("avbröts")
  ) {
    return "Bearbetningen avbröts";
  }

  if (error.message.includes("Network")) {
    return "Nätverksfel. Kontrollera din internetanslutning.";
  }

  return "Något gick fel, försök igen.";
}
