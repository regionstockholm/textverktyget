/**
 * Button State Management Module
 * Handles button state transitions
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
 * Updates a button's loading state
 * @param button - The button element to update
 * @param isLoading - Whether the button should show loading state
 * @returns Success status of the operation
 */
export const updateButtonState = (
  button: HTMLButtonElement,
  isLoading: boolean,
): boolean => {
  console.log(
    `updateButtonState called for button:`,
    button?.id || "unknown",
    `isLoading:`,
    isLoading,
  );
  try {
    // Add assertions to validate inputs
    if (
      !assert(
        button !== null && button !== undefined,
        "Button must not be null or undefined",
      )
    ) {
      return false;
    }

    if (
      !assert(
        button instanceof HTMLButtonElement,
        "Button must be an HTMLButtonElement",
      )
    ) {
      return false;
    }

    if (
      !assert(typeof isLoading === "boolean", "isLoading must be a boolean")
    ) {
      return false;
    }

    // Update button state
    button.disabled = isLoading;
    button.classList.toggle("loading", isLoading);

    // Add assertion to validate the operation was successful
    return true;
  } catch (error) {
    console.error("Error updating button state:", error);
    return false;
  }
};
