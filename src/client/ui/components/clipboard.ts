/**
 * Clipboard Functionality Module
 * Handles copying text to clipboard with fallbacks for browser compatibility
 */

/**
 * Simple assertion function to validate inputs
 * @param condition - The condition to assert
 * @param message - Error message if assertion fails
 * @returns Whether assertion passed
 */
const assert = (condition: boolean, message: string): boolean => {
  if (!condition) {
    console.error(`Assertion failed: ${message}`);
    return false;
  }
  return true;
};

/**
 * Copies text to clipboard with fallback for older browsers
 * @param text - Text to copy to clipboard
 * @returns Whether the copy operation was successful
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  console.log(`copyToClipboard called with text length:`, text?.length || 0);
  if (
    !assert(
      text !== undefined && text !== null,
      "Text cannot be null or undefined",
    )
  ) {
    return false;
  }

  if (!assert(typeof text === "string", "Text must be a string")) {
    return false;
  }

  try {
    // Modern clipboard API
    await navigator.clipboard.writeText(text);
    console.log("Text copied to clipboard successfully using Clipboard API");
    return true;
  } catch (err) {
    console.warn("Clipboard API failed, trying fallback:", err);
    // Fallback for older browsers
    return copyToClipboardFallback(text);
  }
};

/**
 * Fallback method for copying text to clipboard in older browsers
 * @param text - Text to copy to clipboard
 * @returns Whether the copy operation was successful
 */
const copyToClipboardFallback = (text: string): boolean => {
  console.log(`copyToClipboardFallback called`);
  if (!assert(typeof text === "string", "Text must be a string")) {
    return false;
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Make the textarea out of viewport
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";

    document.body.appendChild(textArea);
    textArea.select();

    const success = document.execCommand("copy");
    document.body.removeChild(textArea);

    console.log("Text copied to clipboard using fallback method:", success);
    return success;
  } catch (fallbackErr) {
    console.error("Clipboard API failed, no fallback available", fallbackErr);
    return false;
  }
};
