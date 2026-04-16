/**
 * DOM Utilities Module
 * Provides utility functions for DOM operations
 *
 * This is a centralized module for all DOM-related utilities across the application
 * to ensure consistency and avoid code duplication.
 */

import { assert } from "../../safety/assertions.js";
import { validateElement, validateNotEmpty } from "../../../utils/safety-utils.js";

/**
 * Type for HTML element attributes
 */
export interface ElementAttributes {
  [key: string]: string | number | boolean | Record<string, string> | undefined;
  className?: string;
  dataset?: Record<string, string>;
}

/**
 * Creates a DOM element with safety checks
 * @param tagName - HTML tag name
 * @param attributes - Attributes to set on the element
 * @param content - Text content or child element
 * @returns The created element
 */
export function createElement(
  tagName: string,
  attributes: ElementAttributes = {},
  content: string | HTMLElement | null = null,
): HTMLElement {
  assert(typeof tagName === "string", "Tag name must be a string");
  assert(typeof attributes === "object", "Attributes must be an object");

  const element = document.createElement(tagName);

  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className" && value !== undefined) {
      element.className = value as string;
    } else if (key === "dataset" && value !== undefined) {
      const dataset = value as Record<string, string>;
      for (const [dataKey, dataValue] of Object.entries(dataset)) {
        element.dataset[dataKey] = dataValue;
      }
    } else if (value !== undefined) {
      element.setAttribute(key, String(value));
    }
  }

  if (content) {
    if (typeof content === "string") {
      element.textContent = content;
    } else if (content instanceof HTMLElement) {
      element.appendChild(content);
    }
  }

  return element;
}

/**
 * Safely gets an element by ID with validation
 * @param id - Element ID to find
 * @returns The found element or null
 */
export function getElementByIdSafe(id: string): HTMLElement | null {
  validateNotEmpty(id, "Element ID");

  const element = document.getElementById(id);
  // Only log if element is not found (potential issue)
  if (!element) {
    console.warn(`Element not found: #${id}`);
  }
  return element; // May be null if not found
}

/**
 * Safely finds an element by selector with validation
 * @param selector - CSS selector
 * @returns The found element or null
 */
export function querySelectorSafe(selector: string): Element | null {
  validateNotEmpty(selector, "CSS selector");

  try {
    const element = document.querySelector(selector);
    // Only log if element is not found (potential issue)
    if (!element) {
      console.warn(`Element not found: ${selector}`);
    }
    return element;
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * Safely finds all elements matching a selector with validation
 * @param selector - CSS selector
 * @returns NodeList of matching elements or empty NodeList
 */
export function querySelectorAllSafe(selector: string): NodeListOf<Element> {
  validateNotEmpty(selector, "CSS selector");

  try {
    const elements = document.querySelectorAll(selector);
    // Only log if no elements found (potential issue)
    if (elements.length === 0) {
      console.warn(`No elements found: ${selector}`);
    }
    return elements;
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return document.querySelectorAll(""); // Return empty NodeList
  }
}

/**
 * Safely updates element content as plain text
 * @param element - Element to update
 * @param content - Content to set
 * @returns True if update was successful
 */
export function updateElementContent(
  element: Element,
  content: string,
): boolean {
  try {
    validateElement(element, "Target element");
    assert(typeof content === "string", "Content must be a string");

    // Use textContent to avoid unsafe HTML injection.
    element.textContent = content;
    return true;
  } catch (error) {
    console.error("Failed to update element content:", error);
    return false;
  }
}

/**
 * Safely updates element text content with validation (no HTML parsing)
 * @param element - Element to update
 * @param content - Text content to set
 * @returns True if update was successful
 */
export function updateElementTextContent(
  element: Element,
  content: string,
): boolean {
  try {
    validateElement(element, "Target element");
    assert(typeof content === "string", "Content must be a string");

    // Text content update (no logging for normal operations)
    element.textContent = content;
    return true;
  } catch (error) {
    console.error("Failed to update element text content:", error);
    return false;
  }
}

/**
 * Safely updates element attribute with validation
 * @param element - Element to update
 * @param attributeName - Name of the attribute to set
 * @param attributeValue - Value to set
 * @returns True if update was successful
 */
export function updateElementAttribute(
  element: Element,
  attributeName: string,
  attributeValue: string,
): boolean {
  try {
    validateElement(element, "Target element");
    validateNotEmpty(attributeName, "Attribute name");
    validateNotEmpty(attributeValue, "Attribute value");

    // Attribute update (no logging for normal operations)
    element.setAttribute(attributeName, attributeValue);
    return true;
  } catch (error) {
    console.error("Failed to update element attribute:", error);
    return false;
  }
}

/**
 * Safely removes an element if it exists
 * @param element - Element to remove
 * @returns True if removal was successful or element didn't exist
 */
export function removeElementSafe(element: Element | null): boolean {
  if (!element) {
    // No element to remove (normal case)
    return true; // Nothing to remove
  }

  try {
    validateElement(element, "Element to remove");
    // Element removal (no logging for normal operations)

    if (element.parentNode) {
      element.parentNode.removeChild(element);
    } else {
      element.remove();
    }

    return true;
  } catch (error) {
    console.error("Failed to remove element:", error);
    return false;
  }
}

/**
 * Safely appends a child element with validation
 * @param parent - Parent element
 * @param child - Child element to append
 * @returns True if append was successful
 */
export function appendChildSafe(
  parent: Element | null,
  child: Element | null,
): boolean {
  if (!parent || !child) {
    console.error("appendChildSafe: Parent or child is null or undefined", {
      parent: !!parent,
      child: !!child,
    });
    return false;
  }

  try {
    validateElement(parent, "Parent element");
    validateElement(child, "Child element");

    // Child append (no logging for normal operations)
    parent.appendChild(child);
    return true;
  } catch (error) {
    console.error("Failed to append child:", error);
    return false;
  }
}

/**
 * Safely adds an event listener with validation
 * @param element - Element to add listener to
 * @param eventType - Event type (e.g., 'click')
 * @param handler - Event handler function
 * @returns True if listener was added successfully
 */
export function addEventListenerSafe<K extends keyof HTMLElementEventMap>(
  element: Element,
  eventType: K,
  handler: (this: Element, ev: HTMLElementEventMap[K]) => any,
): boolean;
export function addEventListenerSafe(
  element: Element,
  eventType: string,
  handler: EventListenerOrEventListenerObject,
): boolean;
export function addEventListenerSafe(
  element: Element,
  eventType: string,
  handler: EventListenerOrEventListenerObject,
): boolean {
  try {
    validateElement(element, "Target element");
    validateNotEmpty(eventType, "Event type");
    assert(
      typeof handler === "function" || typeof handler === "object",
      "Event handler must be a function or an object with a handleEvent method",
    );

    // Event listener added (no logging for normal operations)
    element.addEventListener(eventType, handler);
    return true;
  } catch (error) {
    console.error("Failed to add event listener:", error);
    return false;
  }
}

/**
 * Safely removes an event listener with validation
 * @param element - Element to remove listener from
 * @param eventType - Event type
 * @param handler - Event handler function
 * @returns True if listener was removed successfully
 */
export function removeEventListenerSafe<K extends keyof HTMLElementEventMap>(
  element: Element,
  eventType: K,
  handler: (this: Element, ev: HTMLElementEventMap[K]) => any,
): boolean;
export function removeEventListenerSafe(
  element: Element,
  eventType: string,
  handler: EventListenerOrEventListenerObject,
): boolean;
export function removeEventListenerSafe(
  element: Element,
  eventType: string,
  handler: EventListenerOrEventListenerObject,
): boolean {
  try {
    validateElement(element, "Target element");
    validateNotEmpty(eventType, "Event type");
    assert(
      typeof handler === "function" || typeof handler === "object",
      "Event handler must be a function or an object with a handleEvent method",
    );

    // Event listener removed (no logging for normal operations)
    element.removeEventListener(eventType, handler);
    return true;
  } catch (error) {
    console.error("Failed to remove event listener:", error);
    return false;
  }
}

/**
 * Prevent default event behavior safely
 * @param event - Event to prevent default on
 * @returns True if successful
 */
export function preventDefaultSafe(event: Event | null): boolean {
  if (!event) {
    console.error("preventDefaultSafe: Event is null or undefined");
    return false;
  }

  try {
    event.preventDefault();
    return true;
  } catch (error) {
    console.error("Failed to prevent default event behavior:", error);
    return false;
  }
}

/**
 * Safely adds a CSS class to an element
 * @param element - Element to add class to
 * @param className - CSS class name to add
 * @returns True if class was added successfully
 */
export function addClassSafe(element: Element, className: string): boolean {
  try {
    validateElement(element, "Target element");
    validateNotEmpty(className, "Class name");

    // Class added (no logging for normal operations)
    element.classList.add(className);
    return true;
  } catch (error) {
    console.error("Failed to add class:", error);
    return false;
  }
}

/**
 * Safely removes a CSS class from an element
 * @param element - Element to remove class from
 * @param className - CSS class name to remove
 * @returns True if class was removed successfully
 */
export function removeClassSafe(element: Element, className: string): boolean {
  try {
    validateElement(element, "Target element");
    validateNotEmpty(className, "Class name");

    // Class removed (no logging for normal operations)
    element.classList.remove(className);
    return true;
  } catch (error) {
    console.error("Failed to remove class:", error);
    return false;
  }
}

/**
 * Safely toggles a CSS class on an element
 * @param element - Element to toggle class on
 * @param className - CSS class name to toggle
 * @param force - If true, adds class; if false, removes class
 * @returns True if class was toggled successfully
 */
export function toggleClassSafe(
  element: Element,
  className: string,
  force?: boolean,
): boolean {
  try {
    validateElement(element, "Target element");
    validateNotEmpty(className, "Class name");

    // Class toggled (no logging for normal operations)
    element.classList.toggle(className, force);
    return true;
  } catch (error) {
    console.error("Failed to toggle class:", error);
    return false;
  }
}
