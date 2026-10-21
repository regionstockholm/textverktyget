import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { useSecureSessionCookie } from "../config/security/access-config.js";
import { validateApiKey } from "../utils/safety-utils.js";

const COOKIE_NAME = "adminSession";
export const ADMIN_SESSION_DURATION_MS = 60 * 60_000;

function signature(value: string, key: string): string {
  return createHmac("sha256", key).update(`admin-browser-session:${value}`).digest("base64url");
}

function cookieOptions() {
  return { httpOnly: true, sameSite: "strict" as const, secure: useSecureSessionCookie(), path: "/" };
}

export function issueAdminSession(res: Response): void {
  const key = process.env.ADMIN_API_KEY;
  if (!key || !validateApiKey(key)) throw new Error("Admin authentication not configured");
  const value = `${Date.now() + ADMIN_SESSION_DURATION_MS}.${randomBytes(32).toString("base64url")}`;
  res.cookie(COOKIE_NAME, `${value}.${signature(value, key)}`, { ...cookieOptions(), maxAge: ADMIN_SESSION_DURATION_MS });
}

export function clearAdminSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

export function hasAdminSession(req: Request, now = Date.now()): boolean {
  const key = process.env.ADMIN_API_KEY;
  if (!key || !validateApiKey(key)) return false;
  const cookies = (req.headers.cookie || "").split(";").map(cookie => cookie.trim());
  const cookie = cookies.find(value => value.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!cookie || cookie.length > 256) return false;
  const match = cookie.match(/^(\d{13})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return false;
  const [, expires, nonce, signed] = match;
  const expiry = Number(expires);
  if (expiry <= now || expiry > now + ADMIN_SESSION_DURATION_MS) return false;
  const expected = Buffer.from(signature(`${expires}.${nonce}`, key));
  const candidate = Buffer.from(signed!);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
