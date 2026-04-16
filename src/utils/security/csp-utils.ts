/**
 * Content Security Policy Utilities
 *
 * Provides utilities for secure CSP implementation including nonce generation.
 *
 * @module utils/security/csp-utils
 * @version 1.0.0
 */

"use strict";

import crypto from "crypto";
import { assert } from "../safety-utils.js";
import { config } from "../../config/app-config.js";

/**
 * Generates a secure nonce for CSP
 *
 * @param {number} [size=16] - Size of the random bytes
 * @returns {string} Base64 encoded nonce
 */
export function generateSecureNonce(size: number = 16): string {
  // Assert preconditions
  assert(typeof size === "number", "Size must be a number");
  assert(size > 0, "Size must be positive");
  assert(size <= 32, "Size must not exceed 32 bytes");

  // Check return value
  const nonce = crypto.randomBytes(size).toString("base64");
  assert(typeof nonce === "string", "Generated nonce must be a string");

  return nonce;
}

/**
 * Generates CSP header directives
 *
 * @param {string} nonce - CSP nonce value
 * @returns {string} CSP header value
 */
export function generateCSPDirectives(nonce: string): string {
  // Assert preconditions
  assert(typeof nonce === "string", "Nonce must be a string");
  assert(nonce.length > 0, "Nonce cannot be empty");

  // Simple control flow with clear conditions
  const cspDirectives: string[] = [];

  cspDirectives.push("default-src 'self'");
  cspDirectives.push(
    `script-src 'self' 'nonce-${nonce}' https://cdnjs.cloudflare.com`,
  );
  cspDirectives.push("style-src 'self' 'unsafe-inline'");
  cspDirectives.push("img-src 'self' data:");
  cspDirectives.push("connect-src 'self'");
  cspDirectives.push("font-src 'self'");
  cspDirectives.push("object-src 'none'");
  cspDirectives.push("base-uri 'self'");
  cspDirectives.push("frame-ancestors 'none'");
  cspDirectives.push("form-action 'self'");

  // Add production-specific directives
  if (config.isProduction) {
    cspDirectives.push("upgrade-insecure-requests");
  }

  // Check return value
  const cspHeader = cspDirectives.join("; ");
  assert(typeof cspHeader === "string", "CSP header must be a string");

  return cspHeader;
}
