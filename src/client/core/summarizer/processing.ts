import { fileLimits } from "../../../config/shared-config.js";
import { assert } from "../../safety/assertions.js";

export class TextTooShortError extends Error {
  readonly actualLength: number;
  readonly minLength: number;

  constructor(actualLength: number, minLength: number) {
    super(`Text is too short (${actualLength} < ${minLength})`);
    this.name = "TextTooShortError";
    this.actualLength = actualLength;
    this.minLength = minLength;
  }
}

export function validateSummaryInput(text: string): void {
  assert(typeof text === "string", "Text must be a string");
  if (text.length < fileLimits.minTextLength) {
    throw new TextTooShortError(text.length, fileLimits.minTextLength);
  }
}

export function getSummarizationErrorMessage(error: Error): string {
  if (error instanceof TextTooShortError) {
    return `Texten är för kort. Skriv minst ${error.minLength} tecken (nu ${error.actualLength}).`;
  }

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
