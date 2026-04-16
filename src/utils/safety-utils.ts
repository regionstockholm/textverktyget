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
 * Validate email format (basic)
 * @param email - Email to validate
 * @returns true if valid format
 */
export function validateEmail(email: string): boolean {
  return (
    typeof email === "string" && email.includes("@") && email.includes(".")
  );
}

/**
 * Validate password is present
 * @param password - Password to validate
 * @returns true if valid
 */
export function validatePassword(password: string): boolean {
  return typeof password === "string" && password.length > 0;
}

/**
 * Safe JSON parse with error handling
 * @param jsonString - JSON string to parse
 * @returns Parsed object or null if failed
 */
export function safeJsonParse(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Check if value exists and is not null/undefined
 * @param value - Value to check
 * @returns true if value exists
 */
export function exists<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Validate a string is not empty
 * @param value - String to validate
 * @param name - Name of the value for the error message
 * @throws Error if value is empty
 */
export const validateNotEmpty = (value: string, name: string): void => {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} cannot be empty`);
  }
};

/**
 * Validate a DOM element exists
 * @param element - Element to validate
 * @param name - Name of the element for the error message
 * @throws Error if element is null/undefined
 */
export const validateElement = (element: any, name: string): void => {
  if (!element) {
    throw new Error(`${name} element not found`);
  }
};
