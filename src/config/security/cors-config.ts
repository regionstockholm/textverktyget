/**
 * CORS Configuration Module
 * Configures Cross-Origin Resource Sharing (CORS) settings for the application
 * @module config/security/cors-config
 */

import cors from "cors";
import { Express } from "express";

/**
 * Type definition for CORS origin validation result
 */
type OriginValidationResult = {
  isValid: boolean;
  errorMessage?: string;
};

/**
 * List of allowed origins for local development
 * The list is readonly to prevent accidental modification
 */
const getAllowedOrigins = (): readonly string[] => {
  // Local development origins only
  const origins: string[] = [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
  ];

  // Return as readonly array to prevent modifications
  return Object.freeze([...origins]);
};

/**
 * Validates if the origin is allowed
 * @param origin - Origin to validate
 * @returns Validation result with isValid flag and optional error message
 */
const validateOrigin = (origin: string | undefined): OriginValidationResult => {
  // Allow requests with no origin (like mobile apps, curl, etc.)
  if (!origin) {
    return { isValid: true };
  }

  // Assert that origin is a string when present
  if (typeof origin !== "string") {
    return {
      isValid: false,
      errorMessage: "Origin must be a string",
    };
  }

  // Check if origin is in the allowed list
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    errorMessage: `Origin '${origin}' is not allowed by CORS policy`,
  };
};

/**
 * CORS configuration options with detailed type definition
 */
const corsOptions: cors.CorsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    const validation = validateOrigin(origin);

    if (validation.isValid) {
      callback(null, true);
    } else {
      callback(new Error(validation.errorMessage || "Not allowed by CORS"));
    }
  },
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed request headers
  exposedHeaders: ["Content-Range", "X-Content-Range"], // Headers exposed to client
  maxAge: 86400, // Pre-flight cache duration (24 hours)
  optionsSuccessStatus: 200, // Success status for OPTIONS requests
};

/**
 * Configures CORS middleware for the Express application
 * @param app - Express application instance
 */
const configureCors = (app: Express): void => {
  if (!app) {
    throw new Error("Express application instance is required");
  }
  app.use(cors(corsOptions));
};

export default configureCors;
