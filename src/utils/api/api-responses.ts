/**
 * API Response Utilities Module
 * Provides standardized response handling for API routes
 */

import { Response } from "express";

/**
 * Sends a success response with standardized format
 *
 * @param {Response} res - Express response object
 * @param {any} data - Data to send in response
 * @param {number} status - HTTP status code
 * @returns {void}
 */
export const sendSuccess = (res: Response, data: any, status = 200): void => {
  res.status(status).json({
    success: true,
    data,
  });
};

/**
 * Sends an error response with standardized format
 * In development mode, includes stack trace
 *
 * @param {Response} res - Express response object
 * @param {number} status - HTTP status code (must be a number)
 * @param {string} message - Error message
 * @param {string} details - Optional error details
 * @returns {void}
 */
export const sendError = (
  res: Response,
  status: number,
  message: string,
  details?: string,
): void => {
  const errorResponse: {
    success: boolean;
    error: string;
    details?: string;
    stack?: string;
  } = {
    success: false,
    error: message,
  };

  if (details) {
    errorResponse.details = details;
  }

  res.status(status).json(errorResponse);
};

/**
 * Sends a validation error response
 *
 * @param {Response} res - Express response object
 * @param {string[]} errors - Validation error messages
 * @returns {void}
 */
export const sendValidationError = (res: Response, errors: string[]): void => {
  res.status(400).json({
    success: false,
    error: "Validation Error",
    validationErrors: errors,
  });
};
