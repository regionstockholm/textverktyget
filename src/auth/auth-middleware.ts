import type { NextFunction, Request, Response } from "express";
import { isUserLoginEnabled } from "../config/security/access-config.js";
import { findUserById } from "./user-service.js";

export async function requireUserSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isUserLoginEnabled()) {
    res.locals.submissionUsername = "default_user";
    next();
    return;
  }
  try {
    const user = req.session?.userId ? await findUserById(req.session.userId) : null;
    if (!user) {
      req.session?.destroy(() => undefined);
      if (req.method === "GET" && !req.path.startsWith("/api") && !req.baseUrl.startsWith("/api") && !req.baseUrl.startsWith("/upload")) {
        res.redirect("/login");
      } else {
        res.status(401).json({ success: false, error: "Unauthorized" });
      }
      return;
    }
    res.locals.submissionUsername = user.username;
    res.locals.authenticatedUserId = user.id;
    next();
  } catch {
    res.status(503).json({ success: false, error: "Authentication unavailable" });
  }
}

// Browsers send Origin on same-origin fetch mutations; non-browser clients may omit it.
// Cross-site forms are also rejected using Fetch Metadata when available.
export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get("origin");
  const expected = `${req.protocol}://${req.get("host")}`;
  if (req.get("sec-fetch-site") === "cross-site" || (origin && origin !== expected)) {
    res.status(403).json({ success: false, error: "Cross-origin request rejected" });
    return;
  }
  next();
}
