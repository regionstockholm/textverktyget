import express from "express";
import { authenticateAdminKey } from "../middleware/admin-auth.js";
import { requireSameOrigin } from "./auth-middleware.js";
import { clearAdminSession, issueAdminSession } from "./admin-session.js";

const router = express.Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.post("/login", requireSameOrigin, authenticateAdminKey, (_req, res) => {
  issueAdminSession(res);
  res.json({ success: true });
});
router.post("/logout", requireSameOrigin, (_req, res) => {
  clearAdminSession(res);
  res.json({ success: true });
});
export default router;
