/**
 * Admin Auth Middleware
 * Protects admin routes using a bearer API key or a signed browser session.
 */

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import { sendError } from "../utils/api/api-responses.js";
import { validateApiKey } from "../utils/safety-utils.js";
import { createAuthCooldown } from "./auth-cooldown.js";
import { hasAdminSession } from "../auth/admin-session.js";
import { requireSameOrigin } from "../auth/auth-middleware.js";

const adminCooldown = createAuthCooldown();

const AUTH_HEADER_PREFIX = "Bearer ";
const DEFAULT_AUTH_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_AUTH_MAX_ATTEMPTS = 20;

function readEnvInteger(
  envKey: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[envKey];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function secureTokenCompare(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (candidateBuffer.length !== expectedBuffer.length) {
    const maxLength = Math.max(candidateBuffer.length, expectedBuffer.length, 1);
    const paddedCandidate = Buffer.alloc(maxLength);
    const paddedExpected = Buffer.alloc(maxLength);

    candidateBuffer.copy(paddedCandidate);
    expectedBuffer.copy(paddedExpected);
    timingSafeEqual(paddedCandidate, paddedExpected);
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

const authLimiterWindowMs = readEnvInteger(
  "ADMIN_AUTH_RATE_LIMIT_WINDOW_MS",
  DEFAULT_AUTH_WINDOW_MS,
  1000,
  60 * 60 * 1000,
);
const authLimiterMaxAttempts = readEnvInteger(
  "ADMIN_AUTH_RATE_LIMIT_MAX",
  DEFAULT_AUTH_MAX_ATTEMPTS,
  1,
  1000,
);

export const adminAuthLimiter = rateLimit({
  windowMs: authLimiterWindowMs,
  max: authLimiterMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: "Too many admin authentication attempts, please try again later",
  },
});

/**
 * Extracts bearer token from authorization header
 *
 * @param {string|undefined} authorizationHeader - Authorization header value
 * @returns {string|null} Extracted token or null if invalid
 */
function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }

  if (authorizationHeader.startsWith(AUTH_HEADER_PREFIX)) {
    const token = authorizationHeader.substring(AUTH_HEADER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return null;
  }

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Requires a valid admin API key in the Authorization header
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 */
export const authenticateAdminKey = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!validateApiKey(adminApiKey) || typeof adminApiKey !== "string") {
    sendError(res, 500, "Admin authentication not configured");
    return;
  }

  adminCooldown.middleware(req, res, () => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token || token.length > 4096 || !secureTokenCompare(token, adminApiKey)) {
      adminCooldown.failure(req, res, 401, "Unauthorized");
      return;
    }
    adminCooldown.success(req);
    next();
  });
};

export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  // An explicit bearer header always takes precedence over a browser cookie.
  if (!req.headers.authorization && hasAdminSession(req)) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) requireSameOrigin(req, res, next);
    else next();
    return;
  }
  authenticateAdminKey(req, res, next);
};
