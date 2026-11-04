import type { Router } from "express";
import { exportSubmissionCsv, getSubmissionLogSettings, setSubmissionLogRetention, MIN_RETENTION_DAYS } from "../../services/submission-log-service.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";
import { downloadCsv } from "../../utils/api/csv-download.js";

export function registerSubmissionLogRoutes(router: Router): void {
  router.use("/submission-log", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/submission-log/settings", async (_req, res) => {
    try { sendSuccess(res, await getSubmissionLogSettings()); }
    catch { sendError(res, 503, "Submission log settings unavailable"); }
  });
  router.put("/submission-log/settings", async (req, res) => {
    const value: unknown = req.body?.retentionDays;
    try {
      if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < MIN_RETENTION_DAYS || value > 36500)) {
        sendError(res, 400, `Retention must be ${MIN_RETENTION_DAYS}–36500 days, or null to use .env`); return;
      }
      await setSubmissionLogRetention(value);
      sendSuccess(res, await getSubmissionLogSettings());
    } catch { sendError(res, 503, "Unable to save submission log settings"); }
  });
  router.get("/submission-log/export.csv", async (_req, res) => {
    try {
      await downloadCsv(res, exportSubmissionCsv(), "submission-log.csv");
    } catch {
      if (res.headersSent) res.destroy();
      else sendError(res, 503, "Submission log export unavailable");
    }
  });
}
