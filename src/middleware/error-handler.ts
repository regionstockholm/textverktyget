/**
 * Error Handler Middleware
 *
 * Provides centralized error handling for the application with environment-specific responses.
 */

"use strict";

import { Request, Response, NextFunction } from "express";
import { config } from "../config/app-config.js";
import { assert } from "../utils/safety-utils.js";

// Extend Error interface to include custom properties
interface CustomError extends Error {
  statusCode?: number;
  originalValue?: any;
}

/**
 * Constants for error handling configuration
 * @constant {Object}
 */
const ERROR_CONSTANTS = Object.freeze({
  // Maximum stack trace length to log (in characters)
  MAX_STACK_LENGTH: 2000,
  // Default status code for unspecified errors
  DEFAULT_STATUS_CODE: 500,
  // Default error messages
  MESSAGES: {
    UNKNOWN: "Unknown error",
    GENERIC_PRODUCTION: "An error occurred",
    HANDLER_FAILED: "Internal server error",
  },
});

/**
 * Validates that a value is a string or undefined
 *
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateStringOrUndefined(value: any, paramName: string): boolean {
  assert(
    typeof value === "string" || value === undefined,
    `${paramName} must be a string or undefined`,
  );
  return true;
}

/**
 * Safely truncates a string to a maximum length
 *
 * @param {string|undefined} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string|undefined} Truncated string or undefined
 */
function safeTruncate(
  str: string | undefined,
  maxLength: number,
): string | undefined {
  // Assert preconditions
  validateStringOrUndefined(str, "Input");
  assert(typeof maxLength === "number", "Max length must be a number");
  assert(maxLength > 0, "Max length must be positive");

  // Handle undefined case
  if (str === undefined) {
    return undefined;
  }

  // Enforce upper bound on string length
  if (str.length <= maxLength) {
    return str;
  }

  return str.substring(0, maxLength) + "... [truncated]";
}

/**
 * Validates an error object
 *
 * @param {Error|any} err - Error object to validate
 * @returns {CustomError} Validated error object
 * @throws {Error} If validation fails
 */
function validateError(err: any): CustomError {
  assert(err !== undefined, "Error object is required");

  // If err is not an Error instance, convert it to one
  if (!(err instanceof Error)) {
    const originalErr = err;
    err = new Error(
      typeof originalErr === "string"
        ? originalErr
        : ERROR_CONSTANTS.MESSAGES.UNKNOWN,
    );
    (err as CustomError).originalValue = originalErr;
  }

  return err as CustomError;
}

/**
 * Validates request and response objects
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateReqRes(req: Request, res: Response): boolean {
  assert(req !== undefined, "Request object is required");
  assert(res !== undefined, "Response object is required");
  assert(typeof req.url === "string", "Request must have a URL");
  assert(typeof req.method === "string", "Request must have a method");
  assert(
    typeof res.status === "function",
    "Response must have a status method",
  );
  assert(typeof res.json === "function", "Response must have a json method");
  return true;
}

/**
 * Creates a sanitized error object for logging
 *
 * @param {CustomError} err - Error object
 * @param {Request} req - Express request object
 * @returns {Object} Sanitized error object
 */
function createSanitizedError(
  err: CustomError,
  req: Request,
): Record<string, any> {
  // Assert preconditions
  err = validateError(err);
  assert(req !== undefined, "Request object is required");

  // Declare variables in smallest scope
  const showDebug = config.serverSettings.debug;
  const maxLength = ERROR_CONSTANTS.MAX_STACK_LENGTH;

  // Create sanitized error with safe values
  return {
    message: err.message || ERROR_CONSTANTS.MESSAGES.UNKNOWN,
    stack: showDebug ? safeTruncate(err.stack, maxLength) : undefined,
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    statusCode: err.statusCode || ERROR_CONSTANTS.DEFAULT_STATUS_CODE,
  };
}

/**
 * Creates a client-safe error response
 *
 * @param {CustomError} err - Error object
 * @returns {Object} Client-safe error response
 */
function createErrorResponse(err: CustomError): Record<string, any> {
  // Assert preconditions
  err = validateError(err);

  // Declare variables in smallest scope
  const statusCode = err.statusCode || ERROR_CONSTANTS.DEFAULT_STATUS_CODE;
  const maxLength = ERROR_CONSTANTS.MAX_STACK_LENGTH;

  // Determine appropriate error message based on config
  const message = config.serverSettings.errorDetails
    ? err.message || ERROR_CONSTANTS.MESSAGES.UNKNOWN
    : ERROR_CONSTANTS.MESSAGES.GENERIC_PRODUCTION;

  // Create safe response object
  return {
    error: message,
    status: statusCode,
    details: config.serverSettings.debug ? safeTruncate(err.stack, maxLength) : undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sends a fallback error response when the main error handler fails
 *
 * @param {Response} res - Express response object
 * @param {Error} handlerError - Error from the main error handler
 */
function sendFallbackErrorResponse(res: Response, handlerError: Error): void {
  assert(res !== undefined, "Response object is required");
  assert(handlerError !== undefined, "Handler error is required");

  // Log the error handler failure
  console.error("Error handler failed:", handlerError);

  // Send a simple error response
  try {
    res.status(ERROR_CONSTANTS.DEFAULT_STATUS_CODE).json({
      error: ERROR_CONSTANTS.MESSAGES.HANDLER_FAILED,
      status: ERROR_CONSTANTS.DEFAULT_STATUS_CODE,
      timestamp: new Date().toISOString(),
    });
  } catch (finalError) {
    // Last resort if JSON response fails
    console.error("Final error handler failed:", finalError);
    res
      .status(ERROR_CONSTANTS.DEFAULT_STATUS_CODE)
      .send(ERROR_CONSTANTS.MESSAGES.HANDLER_FAILED);
  }
}

/**
 * Express error handling middleware
 * Sanitizes and formats error responses based on environment
 *
 * @param {Error} err - Error object thrown from any part of the application
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} _next - Express next middleware function (required by Express but not used)
 */
export const errorHandler = (
  err: Error | any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  try {
    // Assert preconditions
    const validatedErr = validateError(err);
    validateReqRes(req, res);

    // Create sanitized error object with environment-appropriate detail level
    const sanitizedError = createSanitizedError(validatedErr, req);

    // Log error details server-side
    console.error("Error:", sanitizedError);

    // Prepare client-safe error response
    const errorResponse = createErrorResponse(validatedErr);

    // Send error response to client
    res.status(errorResponse.status).json(errorResponse);
  } catch (handlerError) {
    // Fallback error handling if the error handler itself fails
    sendFallbackErrorResponse(res, handlerError as Error);
  }
};
