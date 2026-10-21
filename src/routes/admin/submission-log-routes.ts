import type { Router, Response } from "express";
import { exportSubmissionCsv, getSubmissionLogSettings, setSubmissionLogRetention } from "../../services/submission-log-service.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";

async function writeChunk(res: Response, chunk: string): Promise<void> {
  if (res.destroyed) throw new Error("Export disconnected");
  if (res.write(chunk)) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { res.off("drain", drained); res.off("close", closed); res.off("error", failed); };
    const drained = () => { cleanup(); resolve(); };
    const closed = () => { cleanup(); reject(new Error("Export disconnected")); };
    const failed = (error: Error) => { cleanup(); reject(error); };
    res.once("drain", drained); res.once("close", closed); res.once("error", failed);
  });
}

export function registerSubmissionLogRoutes(router: Router): void {
  router.use("/submission-log", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/submission-log/settings", async (_req, res) => {
    try { sendSuccess(res, await getSubmissionLogSettings()); }
    catch { sendError(res, 503, "Submission log settings unavailable"); }
  });
  router.put("/submission-log/settings", async (req, res) => {
    const value: unknown = req.body?.retentionDays;
    try {
      if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 30 || value > 36500)) {
        sendError(res, 400, "Retention must be 30–36500 days, or null to use .env"); return;
      }
      await setSubmissionLogRetention(value);
      sendSuccess(res, await getSubmissionLogSettings());
    } catch { sendError(res, 503, "Unable to save submission log settings"); }
  });
  router.get("/submission-log/export.csv", async (_req, res) => {
    try {
      // First iteration validates the database before starting the download.
      const chunks = exportSubmissionCsv();
      const first = await chunks.next();
      res.type("text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="submission-log.csv"');
      if (first.value) await writeChunk(res, first.value);
      try {
        for await (const chunk of chunks) await writeChunk(res, chunk);
      } finally { await chunks.return(undefined); }
      res.end();
    } catch {
      if (res.headersSent) res.destroy();
      else sendError(res, 503, "Submission log export unavailable");
    }
  });
}
