import type { Router } from "express";
import { exportAccessCsv } from "../../services/access-log-service.js";
import { downloadCsv } from "../../utils/api/csv-download.js";
import { sendError } from "../../utils/api/api-responses.js";

export function registerAccessLogRoutes(router: Router): void {
  router.get("/access-log/export.csv", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { await downloadCsv(res, exportAccessCsv(), "access-log.csv"); }
    catch {
      if (res.headersSent) res.destroy();
      else sendError(res, 503, "Access log export unavailable");
    }
  });
}
