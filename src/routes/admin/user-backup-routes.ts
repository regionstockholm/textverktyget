import express, { type Router, type RequestHandler } from "express";
import { isUserLoginEnabled } from "../../config/security/access-config.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";
import { InvalidUserBackupError, MAX_BACKUP_BYTES } from "../../validators/user-backup-validator.js";
import { exportUserBackup, restoreUserBackup, UserBackupConflictError } from "../../services/user-backup-service.js";

// Mount before the application's general JSON parser so whitespace and chunked
// uploads also obey the feature's byte limit. Never expose parser error bodies.
const parseImport = express.json({ limit: MAX_BACKUP_BYTES });
export const userBackupImportParser: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  parseImport(req, res, error => {
    if (!error) { next(); return; }
    const tooLarge = (error as { type?: string }).type === "entity.too.large";
    sendError(res, tooLarge ? 413 : 400, tooLarge ? "User backup exceeds 1 MiB" : "Invalid user backup JSON");
  });
};

// Register only behind the admin authentication and rate-limit middleware.
export function registerUserBackupRoutes(router: Router, service = {
  exportBackup: () => exportUserBackup(),
  restoreBackup: (value: unknown) => restoreUserBackup(value),
}): void {
  router.use("/user-backup", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isUserLoginEnabled()) { sendError(res, 404, "User login is disabled"); return; }
    next();
  });
  router.get("/user-backup/export", async (_req, res) => {
    try {
      const backup = await service.exportBackup();
      res.attachment(`textverktyg-users-${backup.exportedAt.slice(0, 10)}.json`);
      res.type("application/json").send(JSON.stringify(backup, null, 2));
    } catch (error) {
      sendError(res, error instanceof InvalidUserBackupError ? 400 : 503,
        error instanceof InvalidUserBackupError ? error.message : "Unable to export user backup");
    }
  });
  router.post("/user-backup/import", async (req, res) => {
    const length = Number(req.headers["content-length"]);
    if (length > MAX_BACKUP_BYTES) { sendError(res, 413, "User backup exceeds 1 MiB"); return; }
    try { sendSuccess(res, { imported: await service.restoreBackup(req.body) }); }
    catch (error) {
      const status = error instanceof InvalidUserBackupError ? 400 : error instanceof UserBackupConflictError ? 409 : 503;
      sendError(res, status, status === 503 ? "Unable to restore user backup; no users were changed" : (error as Error).message);
    }
  });
}
