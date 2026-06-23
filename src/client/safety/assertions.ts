/**
 * Assertion Utilities
 */

/**
 * Assert that a condition is true
 * @param condition - The condition to check
 * @param message - Error message if assertion fails
 * @throws {Error} If the assertion fails
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    console.error(`Assertion failed: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}
