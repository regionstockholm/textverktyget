import { createHash } from "node:crypto";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { swedishTime } from "../utils/swedish-time.js";
import { appendAccessLog, initializeSubmissionLogFiles, pruneSubmissionLogFiles } from "./submission-log-files.js";
import { csvCell, retentionCutoff } from "./submission-log-service.js";

export const ACCESS_LOG_RETENTION_DAYS = 90;
let cleanupTimer: ReturnType<typeof setInterval> | undefined;

function sessionReference(sessionId: string): string {
  if (!sessionId) throw new Error("Session identity required");
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function recordAccessLogin(sessionId: string, username: string): Promise<void> {
  if (!username) throw new Error("User identity required");
  const sessionRef = sessionReference(sessionId);
  const rows = await getPrismaClient().accessLog.createManyAndReturn({
    data: { sessionRef, username }, skipDuplicates: true,
  });
  for (const row of rows) {
    try { await appendAccessLog({ username: row.username, session_ref: row.sessionRef, event: "login", time: row.loginAt }); }
    catch { console.error("Access-log file write failed; database record is preserved"); }
  }
}

export async function recordAccessLogout(sessionId: string): Promise<void> {
  const rows = await getPrismaClient().accessLog.updateManyAndReturn({
    where: { sessionRef: sessionReference(sessionId), logoutAt: null },
    data: { logoutAt: new Date() },
  });
  for (const row of rows) {
    try { await appendAccessLog({ username: row.username, session_ref: row.sessionRef, event: "logout", time: row.logoutAt! }); }
    catch { console.error("Access-log file write failed; database record is preserved"); }
  }
}

export async function pruneAccessLogs(): Promise<void> {
  const cutoff = retentionCutoff(ACCESS_LOG_RETENTION_DAYS);
  await pruneSubmissionLogFiles(cutoff, undefined, "access-");
  const prisma = getPrismaClient();
  for (let batch = 0; batch < 10; batch += 1) {
    const rows = await prisma.accessLog.findMany({
      where: { loginAt: { lt: cutoff } }, orderBy: { loginAt: "asc" }, take: 1000, select: { id: true },
    });
    if (!rows.length) break;
    await prisma.accessLog.deleteMany({ where: { id: { in: rows.map(row => row.id) }, loginAt: { lt: cutoff } } });
    if (rows.length < 1000) break;
  }
}

export async function initializeAccessLogging(): Promise<void> {
  await initializeSubmissionLogFiles();
  await pruneAccessLogs();
  cleanupTimer = setInterval(() => {
    void pruneAccessLogs().catch(() => console.error("Access-log cleanup failed; retrying next hour"));
  }, 60 * 60 * 1000);
  cleanupTimer.unref();
}

export function stopAccessLogging(): void {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = undefined;
}

export async function* exportAccessCsv(): AsyncGenerator<string> {
  const prisma = getPrismaClient();
  const cutoff = retentionCutoff(ACCESS_LOG_RETENTION_DAYS);
  const latest = await prisma.accessLog.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  const maxId = latest?.id ?? 0;
  let lastId = 0;
  yield "\uFEFFusername,login_count_in_period,login_time_swedish,logout_time_swedish\r\n";
  while (lastId < maxId) {
    const rows = await prisma.accessLog.findMany({
      where: { id: { gt: lastId, lte: maxId }, loginAt: { gte: cutoff } },
      orderBy: { id: "asc" }, take: 200,
    });
    if (!rows.length) break;
    const counts = await prisma.accessLog.groupBy({
      by: ["username"], _count: { _all: true },
      where: { id: { lte: maxId }, loginAt: { gte: cutoff }, username: { in: [...new Set(rows.map(row => row.username))] } },
    });
    const countByUser = new Map(counts.map(row => [row.username, row._count._all]));
    for (const row of rows) {
      yield [row.username, String(countByUser.get(row.username)), swedishTime(row.loginAt), row.logoutAt ? swedishTime(row.logoutAt) : ""].map(csvCell).join(",") + "\r\n";
      lastId = row.id;
    }
  }
}
