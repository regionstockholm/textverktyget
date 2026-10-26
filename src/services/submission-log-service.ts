import { getPrismaClient } from "../config/database/prisma-client.js";
import {
  appendSubmissionLog,
  initializeSubmissionLogFiles,
  pruneSubmissionLogFiles,
} from "./submission-log-files.js";

const SETTINGS_KEY = "global";
export const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 36500;
let cleanupTimer: ReturnType<typeof setInterval> | undefined;

export function validateRetentionDays(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_RETENTION_DAYS ||
    value > MAX_RETENTION_DAYS
  ) {
    throw new Error(
      `Retention must be an integer between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS} days`,
    );
  }
  return value;
}

export function readEnvironmentRetentionDays(): number {
  return validateRetentionDays(
    Number(process.env.SUBMISSION_LOG_RETENTION_DAYS ?? "30"),
  );
}

export function retentionCutoff(days: number, now = new Date()): Date {
  return new Date(
    now.getTime() - validateRetentionDays(days) * 24 * 60 * 60 * 1000,
  );
}

export async function getSubmissionLogSettings() {
  const environmentDays = readEnvironmentRetentionDays();
  const settings = await getPrismaClient().submissionLogSettings.findUnique({
    where: { key: SETTINGS_KEY },
  });
  const overrideDays = settings?.retentionDays ?? null;
  return {
    environmentDays,
    overrideDays,
    retentionDays:
      overrideDays === null
        ? environmentDays
        : validateRetentionDays(overrideDays),
  };
}

export async function setSubmissionLogRetention(value: unknown): Promise<void> {
  const retentionDays = value === null ? null : validateRetentionDays(value);
  await getPrismaClient().submissionLogSettings.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, retentionDays },
    update: { retentionDays },
  });
}

export async function recordSubmission(
  username: string,
  text: string,
): Promise<void> {
  if (!username || typeof text !== "string")
    throw new Error("Submission identity and text required");
  const submission = await getPrismaClient().submissionLog.create({
    data: { username, text },
  });
  await appendSubmissionLog(submission);
}

export async function pruneSubmissionLogs(): Promise<void> {
  const { retentionDays } = await getSubmissionLogSettings();
  const cutoff = retentionCutoff(retentionDays);
  await pruneSubmissionLogFiles(cutoff);
  const prisma = getPrismaClient();
  // Bound each sweep; catch up over subsequent hourly sweeps without large deletes.
  for (let batch = 0; batch < 10; batch += 1) {
    const rows = await prisma.submissionLog.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: 1000,
      select: { id: true },
    });
    if (!rows.length) break;
    await prisma.submissionLog.deleteMany({
      where: {
        id: { in: rows.map((row) => row.id) },
        createdAt: { lt: cutoff },
      },
    });
    if (rows.length < 1000) break;
  }
}

export async function initializeSubmissionLogging(): Promise<void> {
  await initializeSubmissionLogFiles();
  // Verify migrations/configuration without changing the database schema at runtime.
  await getSubmissionLogSettings();
  await getPrismaClient().submissionLog.findFirst({ select: { id: true } });
  await pruneSubmissionLogs();
  cleanupTimer = setInterval(
    () => {
      void pruneSubmissionLogs().catch(() =>
        console.error("Submission-log cleanup failed; retrying next hour"),
      );
    },
    60 * 60 * 1000,
  );
  cleanupTimer.unref();
}

export function stopSubmissionLogging(): void {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = undefined;
}

// Quote all fields, preserve multiline text, and neutralize spreadsheet formulas.
export function csvCell(value: string): string {
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function* exportSubmissionCsv(): AsyncGenerator<string> {
  const prisma = getPrismaClient();
  const { retentionDays } = await getSubmissionLogSettings();
  const cutoff = retentionCutoff(retentionDays);
  const latest = await prisma.submissionLog.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });
  const maxId = latest?.id ?? 0;
  let lastId = 0;
  yield "\uFEFFusername,time_utc,text\r\n";
  while (lastId < maxId) {
    const rows = await prisma.submissionLog.findMany({
      where: { id: { gt: lastId, lte: maxId }, createdAt: { gte: cutoff } },
      orderBy: { id: "asc" },
      take: 200,
    });
    if (!rows.length) break;
    for (const row of rows) {
      yield [row.username, row.createdAt.toISOString(), row.text]
        .map(csvCell)
        .join(",") + "\r\n";
      lastId = row.id;
    }
  }
}
