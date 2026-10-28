import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { useSecureSessionCookie } from "../config/security/access-config.js";
import { validateApiKey } from "../utils/safety-utils.js";

export const ADMIN_SESSION_DURATION_MS = 60 * 60_000;

function keyFingerprint(key: string): string {
  return createHmac("sha256", key).update("admin-server-session").digest("hex");
}

function cookieOptions() {
  return { httpOnly: true, sameSite: "strict" as const, secure: useSecureSessionCookie(), path: "/" };
}

export async function issueAdminSession(req: Request): Promise<void> {
  const key = process.env.ADMIN_API_KEY;
  if (!key || !validateApiKey(key)) throw new Error("Admin authentication not configured");
  if (!req.session) throw new Error("Admin session storage unavailable");
  await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.admin = { expiresAt: Date.now() + ADMIN_SESSION_DURATION_MS, keyFingerprint: keyFingerprint(key) };
  req.session.cookie.maxAge = ADMIN_SESSION_DURATION_MS;
  req.session.cookie.sameSite = "strict";
  await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}

export async function clearAdminSession(req: Request, res: Response): Promise<void> {
  if (!req.session) throw new Error("Admin session storage unavailable");
  await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  res.clearCookie("sessionId", cookieOptions());
  res.clearCookie("adminSession", cookieOptions());
}

export function hasAdminSession(req: Request, now = Date.now()): boolean {
  const key = process.env.ADMIN_API_KEY;
  if (!key || !validateApiKey(key)) return false;
  const admin = req.session?.admin;
  if (!admin || !Number.isSafeInteger(admin.expiresAt) || admin.expiresAt <= now || admin.expiresAt > now + ADMIN_SESSION_DURATION_MS) return false;
  if (typeof admin.keyFingerprint !== "string" || admin.keyFingerprint.length !== 64) return false;
  const expected = Buffer.from(keyFingerprint(key));
  const candidate = Buffer.from(admin.keyFingerprint);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
