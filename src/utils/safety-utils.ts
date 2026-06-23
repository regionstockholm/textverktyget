/**
 * Simple Safety Utilities
 * Essential validation functions without over-engineering
 */

/**
 * Simple assertion function
 * @param condition - Condition to check
 * @param message - Error message if false
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Validate API key is present and non-empty
 * @param key - API key to validate
 * @returns true if valid
 */
export function validateApiKey(key: string | undefined): boolean {
  return typeof key === "string" && key.length > 0;
}

/**
 * Check if value exists and is not null/undefined
 * @param value - Value to check
 * @returns true if value exists
 */
export function exists<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
