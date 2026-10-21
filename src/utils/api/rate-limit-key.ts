import { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

export function apiRateLimitKey(req: Request, res: Response): string {
  return res.locals.authenticatedUserId !== undefined
    ? `user:${res.locals.authenticatedUserId}`
    : `ip:${ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown")}`;
}
