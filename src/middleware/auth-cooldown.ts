import type { NextFunction, Request, Response } from "express";
import { ipKeyGenerator } from "express-rate-limit";

const FAILURE_THRESHOLD = 5;
const BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 30 * 60_000;
const RESET_AFTER_MS = 60 * 60_000;
const MAX_CLIENTS = 10_000;

type ClientState = { failures: number; blockedUntil: number; lastFailure: number; busy: boolean };

/** Per-IP failed-authentication protection. Create a separate instance for each login flow. */
export function createAuthCooldown(now: () => number = Date.now) {
  const clients = new Map<string, ClientState>();
  let lastSweep = 0;
  const keyFor = (req: Request): string => ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");

  function reject(res: Response, milliseconds: number): void {
    const retryAfterSeconds = Math.max(1, Math.ceil(milliseconds / 1000));
    res.setHeader("Retry-After", retryAfterSeconds);
    res.setHeader("Cache-Control", "no-store");
    res.status(429).json({ success: false, error: "Too many sign-in attempts. Try again later.", retryAfterSeconds });
  }

  function isBlocked(req: Request, res: Response, time: number): boolean {
    const state = clients.get(keyFor(req));
    if (state && state.blockedUntil > time) { reject(res, state.blockedUntil - time); return true; }
    if (state?.busy) { reject(res, 1000); return true; }
    return false;
  }

  // Check before body parsing without reserving a slot that an aborted upload could leave busy.
  const check = (req: Request, res: Response, next: NextFunction): void => {
    if (!isBlocked(req, res, now())) next();
  };

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const time = now();
    if (time - lastSweep >= 60_000) {
      for (const [key, state] of clients) {
        if (!state.busy && time - state.lastFailure >= RESET_AFTER_MS) clients.delete(key);
      }
      lastSweep = time;
    }
    const key = keyFor(req);
    let state = clients.get(key);
    if (state && !state.busy && time - state.lastFailure >= RESET_AFTER_MS) {
      clients.delete(key);
      state = undefined;
    }
    // Serialize authentication per client: parallel guesses cannot slip past the threshold.
    if (isBlocked(req, res, time)) return;
    if (!state) {
      // Never evict an active cooldown to make room for a new client.
      if (clients.size >= MAX_CLIENTS) {
        res.setHeader("Retry-After", "60");
        res.status(503).json({ success: false, error: "Sign-in temporarily unavailable" });
        return;
      }
      state = { failures: 0, blockedUntil: 0, lastFailure: time, busy: false };
      clients.set(key, state);
    }
    state.busy = true;
    const client = state;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      client.busy = false;
      if (client.failures === 0 && clients.get(key) === client) clients.delete(key);
    };
    // An aborted request must not release an authentication operation still in flight.
    res.once("finish", release);
    res.once("close", () => { if (res.writableFinished) release(); });
    next();
  };

  const failure = (req: Request, res: Response, status: number, error: string): void => {
    const state = clients.get(keyFor(req));
    if (!state) { res.status(status).json({ success: false, error }); return; }
    state.failures++;
    state.lastFailure = now();
    if (state.failures >= FAILURE_THRESHOLD) {
      const duration = Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** Math.min(state.failures - FAILURE_THRESHOLD, 16));
      state.blockedUntil = state.lastFailure + duration;
      reject(res, duration);
    } else {
      res.status(status).json({ success: false, error });
    }
    // Also release after an asynchronous authentication completes on an aborted connection.
    if (res.destroyed) state.busy = false;
  };

  const success = (req: Request): void => {
    clients.delete(keyFor(req));
  };

  const unavailable = (req: Request): void => {
    const state = clients.get(keyFor(req));
    if (state) state.busy = false;
  };

  return { check, middleware, failure, success, unavailable };
}
