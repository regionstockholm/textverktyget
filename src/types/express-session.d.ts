import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    admin?: { expiresAt: number; keyFingerprint: string };
  }
}
