import express from "express";
import { createAuthCooldown } from "../middleware/auth-cooldown.js";
import { authenticateUser, findUserById, toSafeUser } from "./user-service.js";
import { requireSameOrigin, requireUserSession } from "./auth-middleware.js";
import { recordAccessLogin, recordAccessLogout } from "../services/access-log-service.js";

const router = express.Router();
const loginCooldown = createAuthCooldown();

router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.post("/login", requireSameOrigin, loginCooldown.middleware, async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || username.length > 100 || !password || Buffer.byteLength(password) > 72) {
    loginCooldown.failure(req, res, 400, "Invalid credentials");
    return;
  }
  try {
    const user = await authenticateUser(username, password);
    if (!user) {
      loginCooldown.failure(req, res, 401, "Invalid username or password");
      return;
    }
    await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    loginCooldown.success(req);
    res.json({ success: true, data: { user: toSafeUser(user) } });
  } catch {
    loginCooldown.unavailable(req);
    res.status(503).json({ success: false, error: "Login unavailable" });
  }
});

router.get("/check", async (req, res) => {
  try {
    const user = req.session?.userId ? await findUserById(req.session.userId) : null;
    if (!user) {
      req.session?.destroy(() => undefined);
      res.status(401).json({ isAuthenticated: false });
      return;
    }
    res.json({ isAuthenticated: true, user: toSafeUser(user) });
  } catch {
    res.status(503).json({ isAuthenticated: false });
  }
});

router.post("/session-start", requireSameOrigin, requireUserSession, async (req, res) => {
  try {
    if (!req.session.accessLogRecorded) {
      await recordAccessLogin(req.sessionID, res.locals.submissionUsername);
      req.session.accessLogRecorded = true;
      await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    }
    res.json({ success: true });
  } catch {
    console.error("Access-log login confirmation failed");
    res.status(503).json({ success: false, error: "Session logging unavailable" });
  }
});

router.post("/logout", requireSameOrigin, async (req, res) => {
  const sessionId = req.sessionID;
  try {
    await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  } catch {
    res.status(503).json({ success: false });
    return;
  }
  res.clearCookie("sessionId", { path: "/" });
  try { await recordAccessLogout(sessionId); }
  catch { console.error("Access-log logout recording failed; session was destroyed"); }
  res.json({ success: true });
});

export default router;
