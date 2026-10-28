import express from "express";
import { authenticateAdminKey } from "../middleware/admin-auth.js";
import { requireSameOrigin } from "./auth-middleware.js";
import { clearAdminSession, issueAdminSession } from "./admin-session.js";
import { parseLoginBody } from "./login-body.js";

const router = express.Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.post("/login", requireSameOrigin, authenticateAdminKey, parseLoginBody, async (req, res) => {
  try {
    await issueAdminSession(req);
    res.json({ success: true });
  } catch {
    res.status(503).json({ success: false, error: "Admin login unavailable" });
  }
});
router.post("/logout", requireSameOrigin, async (req, res) => {
  try {
    await clearAdminSession(req, res);
    res.json({ success: true });
  } catch {
    res.status(503).json({ success: false, error: "Admin logout unavailable" });
  }
});
export default router;
