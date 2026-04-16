/**
 * Assertion Utilities
 */

import { safetyConfig } from "../../config/shared-config.js";

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

/**
 * Safely iterate over a collection with a maximum iteration limit
 * @param collection - The collection to iterate over
 * @param callback - Function to call for each item
 * @throws {Error} If iteration limit is exceeded
 */
export function safeIterate<T>(
  collection: T[] | Record<string, T>,
  callback: (item: T, key: string | number) => void,
): void {
  if (!collection) {
    throw new Error("Collection must not be null or undefined");
  }
  if (typeof callback !== "function") {
    throw new Error("Callback must be a function");
  }

  let count = 0;

  if (Array.isArray(collection)) {
    for (
      let i = 0;
      i < collection.length && i < safetyConfig.MAX_ITERATIONS;
      i++
    ) {
      const item = collection[i];
      if (item !== undefined) {
        callback(item, i);
        count++;
      }
    }
  } else if (typeof collection === "object") {
    for (const key in collection) {
      if (count >= safetyConfig.MAX_ITERATIONS) break;
      if (Object.prototype.hasOwnProperty.call(collection, key)) {
        const item = collection[key];
        if (item !== undefined) {
          callback(item, key);
          count++;
        }
      }
    }
  }

  if (count >= safetyConfig.MAX_ITERATIONS) {
    console.warn("Iteration limit reached in safeIterate");
  }
}
