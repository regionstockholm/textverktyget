import { assert } from "../../safety/assertions.js";

export type ElementAttributes = {
  [key: string]: string | number | boolean | Record<string, string> | undefined;
  className?: string;
  dataset?: Record<string, string>;
};

function assertNonEmpty(value: string, label: string): void {
  assert(
    typeof value === "string" && value.trim().length > 0,
    `${label} is required`,
  );
}

function applyAttributes(
  element: HTMLElement,
  attributes: ElementAttributes,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }

    if (key === "className") {
      element.className = value as string;
      continue;
    }

    if (key === "dataset") {
      const dataset = value as Record<string, string>;
      for (const [dataKey, dataValue] of Object.entries(dataset)) {
        element.dataset[dataKey] = dataValue;
      }
      continue;
    }

    element.setAttribute(key, String(value));
  }
}

export function createElement(
  tagName: string,
  attributes: ElementAttributes = {},
  content: string | HTMLElement | null = null,
): HTMLElement {
  assertNonEmpty(tagName, "Tag name");

  const element = document.createElement(tagName);
  applyAttributes(element, attributes);

  if (typeof content === "string") {
    element.textContent = content;
  } else if (content instanceof HTMLElement) {
    element.appendChild(content);
  }

  return element;
}

export function getById<T extends HTMLElement = HTMLElement>(
  id: string,
): T | null {
  assertNonEmpty(id, "Element ID");
  return document.getElementById(id) as T | null;
}

export function requireById<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = getById<T>(id);
  assert(element !== null, `Element not found: #${id}`);
  return element;
}

export function query<T extends Element = Element>(selector: string): T | null {
  assertNonEmpty(selector, "Selector");
  return document.querySelector(selector) as T | null;
}
