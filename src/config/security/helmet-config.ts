/**
 * Helmet Security Configuration Module
 * Configures Helmet middleware and security policies for the application
 * @module config/security/helmet-config
 */

import helmet, { HelmetOptions } from "helmet";
import { Express } from "express";
import { config } from "../app-config.js";

/**
 * Minimum recommended HSTS max age (1 year in seconds)
 */
const MINIMUM_HSTS_MAX_AGE = 31536000;

/**
 * Valid Content Security Policy sandbox values
 */
const VALID_SANDBOX_VALUES = [
  "allow-forms",
  "allow-scripts",
  "allow-same-origin",
  "allow-top-navigation",
  "allow-popups",
];

/**
 * Verify the Helmet version is compatible
 * Throws error if the version is not compatible
 */
const verifyHelmetCompatibility = (): void => {
  // Check if helmet is available
  if (!helmet || typeof helmet !== "function") {
    throw new Error(
      "Helmet middleware is not properly loaded or is incompatible",
    );
  }
};

/**
 * Validates the Content Security Policy configuration
 * @param cspConfig - The CSP configuration to validate
 * @throws Error if the configuration is invalid
 */
const validateCSPConfig = (cspConfig: any): void => {
  if (!cspConfig || typeof cspConfig !== "object") {
    throw new Error("CSP configuration must be an object");
  }

  if (!cspConfig.directives || typeof cspConfig.directives !== "object") {
    throw new Error("CSP directives must be an object");
  }

  // Critical directives that should be set
  const criticalDirectives = ["defaultSrc", "scriptSrc", "objectSrc"];
  for (const directive of criticalDirectives) {
    if (!cspConfig.directives[directive]) {
      throw new Error(`CSP critical directive '${directive}' is missing`);
    }
  }

  // Check sandbox values if present
  if (cspConfig.directives.sandbox) {
    if (!Array.isArray(cspConfig.directives.sandbox)) {
      throw new Error("CSP sandbox directive must be an array");
    }

    for (const value of cspConfig.directives.sandbox) {
      if (!VALID_SANDBOX_VALUES.includes(value)) {
        throw new Error(`Invalid sandbox value: ${value}`);
      }
    }
  }
};

/**
 * Validates the HSTS configuration
 * @param hstsConfig - The HSTS configuration to validate
 * @throws Error if the configuration is invalid
 */
const validateHSTSConfig = (hstsConfig: any): void => {
  if (!hstsConfig || typeof hstsConfig !== "object") {
    throw new Error("HSTS configuration must be an object");
  }

  if (typeof hstsConfig.maxAge !== "number") {
    throw new Error("HSTS maxAge must be a number");
  }

  if (hstsConfig.maxAge < MINIMUM_HSTS_MAX_AGE) {
    throw new Error(
      `HSTS maxAge should be at least ${MINIMUM_HSTS_MAX_AGE} seconds (1 year)`,
    );
  }

  if (config.isProduction && hstsConfig.includeSubDomains !== true) {
    throw new Error("HSTS includeSubDomains must be true in production");
  }
};

/**
 * Creates the Content Security Policy configuration
 * @returns Content Security Policy configuration object
 */
const createContentSecurityPolicy = () => {
  const cspConfig = {
    directives: {
      defaultSrc: ["'self'"], // Only allow resources from same origin
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"], // Allow scripts from self and CDN
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow styles from self and inline
      imgSrc: ["'self'", "data:"], // Allow images from same origin and data URIs
      connectSrc: ["'self'"], // Only allow API requests to same origin
      fontSrc: ["'self'"], // Only allow fonts from same origin
      objectSrc: ["'none'"], // Block <object>, <embed>, and <applet> elements
      mediaSrc: ["'self'"], // Only allow media from same origin
      frameSrc: ["'none'"], // Block all frames
      sandbox: ["allow-forms", "allow-scripts", "allow-same-origin"], // Restrict iframe capabilities
      reportUri: "/report-violation", // CSP violation reporting endpoint
      upgradeInsecureRequests: config.isProduction ? [] : null, // Force HTTPS in prod
    },
  };

  // Validate the CSP configuration
  validateCSPConfig(cspConfig);

  return cspConfig;
};

/**
 * Generates security configuration for Helmet middleware
 * @returns Helmet configuration object with appropriate security settings
 */
const getSecurityConfig = (): HelmetOptions => {
  // First verify Helmet compatibility
  verifyHelmetCompatibility();

  const config: HelmetOptions = {
    contentSecurityPolicy: createContentSecurityPolicy(),
    crossOriginEmbedderPolicy: true, // Prevent loading cross-origin resources
    crossOriginOpenerPolicy: { policy: "same-origin" }, // Isolate cross-origin windows
    crossOriginResourcePolicy: { policy: "same-origin" }, // Prevent cross-origin resource loading
    dnsPrefetchControl: { allow: false }, // Disable DNS prefetching
    frameguard: { action: "deny" }, // Prevent clickjacking
    hidePoweredBy: true, // Remove X-Powered-By header
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true, // Prevent IE from executing downloads
    noSniff: true, // Prevent MIME type sniffing
    originAgentCluster: true, // Enable Origin-Agent Cluster header
    permittedCrossDomainPolicies: { permittedPolicies: "none" }, // Disable Adobe Flash
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }, // Control referrer information
    xssFilter: true, // Enable XSS filtering
  };

  // Validate HSTS configuration
  if (typeof config.hsts === "object") {
    validateHSTSConfig(config.hsts);
  }

  return config;
};

/**
 * Configures Helmet middleware for the Express application
 * @param app - Express application instance
 */
const configureHelmet = (app: Express): void => {
  if (!app) {
    throw new Error("Express app is required for configuring Helmet");
  }

  app.use(helmet(getSecurityConfig()));
};

export default configureHelmet;
