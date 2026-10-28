import express from "express";
import { createAuthCooldown } from "../middleware/auth-cooldown.js";
import { authenticateUser, findUserById, toSafeUser } from "./user-service.js";
import { requireSameOrigin } from "./auth-middleware.js";
import { parseLoginBody } from "./login-body.js";

const router = express.Router();
const loginCooldown = createAuthCooldown();

router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.post("/login", requireSameOrigin, loginCooldown.check, parseLoginBody, loginCooldown.middleware, async (req, res) => {
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

router.post("/logout", requireSameOrigin, (req, res) => {
  req.session.destroy(error => {
    res.clearCookie("sessionId", { path: "/" });
    res.status(error ? 503 : 200).json({ success: !error });
  });
});

export default router;
