import type { Router } from "express";
import { createUser, deleteUser, listUsers, toSafeUser } from "../../auth/user-service.js";
import { isUserLoginEnabled } from "../../config/security/access-config.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";

export function registerAdminUserRoutes(router: Router): void {
  router.use("/users", (_req, res, next) => {
    if (!isUserLoginEnabled()) { sendError(res, 404, "User login is disabled"); return; }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/users", async (_req, res) => {
    try { sendSuccess(res, { users: (await listUsers()).map(toSafeUser) }); }
    catch { sendError(res, 503, "Users unavailable"); }
  });
  router.post("/users", async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!username || username.length > 100 || password.length < 16 || Buffer.byteLength(password) > 72) {
      sendError(res, 400, "Username required (max 100 characters); password must be at least 16 characters and at most 72 bytes");
      return;
    }
    try { sendSuccess(res, { user: toSafeUser(await createUser(username, password)) }, 201); }
    catch (error) {
      const duplicate = (error as { code?: string }).code === "P2002";
      sendError(res, duplicate ? 409 : 503, duplicate ? "User already exists" : "Unable to create user");
    }
  });
  router.delete("/users/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) { sendError(res, 400, "Invalid user id"); return; }
    try {
      if (!await deleteUser(id)) { sendError(res, 404, "User not found"); return; }
      sendSuccess(res, { deleted: true });
    } catch { sendError(res, 503, "Unable to delete user"); }
  });
}
