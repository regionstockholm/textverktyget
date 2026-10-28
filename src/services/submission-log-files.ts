import { constants } from "node:fs";
import { access, appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";

type Submission = { username: string; text: string; createdAt: Date };
let fileQueue: Promise<void> = Promise.resolve();

export function submissionLogDirectory(): string {
  return resolve(process.env.SUBMISSION_LOG_DIRECTORY || "logs");
}

// Serialize writes and cleanup so concurrent submissions cannot interleave lines.
function enqueue(operation: () => Promise<void>): Promise<void> {
  const pending = fileQueue.then(operation);
  fileQueue = pending.catch(() => {});
  return pending;
}

export async function initializeSubmissionLogFiles(directory = submissionLogDirectory()): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o750 });
  await access(directory, constants.W_OK);
}

async function mirrorLogFiles(operation: (directory: string) => Promise<void>): Promise<void> {
  const directory = process.env.SUBMISSION_LOG_MIRROR_DIRECTORY;
  if (!directory || resolve(directory) === submissionLogDirectory()) return;
  try {
    // Never create the optional host directory: only use an existing writable mount.
    await access(directory, constants.R_OK | constants.W_OK | constants.X_OK);
    await operation(directory);
  } catch {
    console.warn("Submission-log host copy failed; primary logging is unaffected");
  }
}

export function appendSubmissionLog(submission: Submission, directory = submissionLogDirectory()): Promise<void> {
  return enqueue(async () => {
    await initializeSubmissionLogFiles(directory);
    const time = submission.createdAt.toISOString();
    const line = JSON.stringify({ username: submission.username, time_utc: time, text: submission.text }) + "\n";
    const append = (target: string, mode: number) => appendFile(join(target, `${time.slice(0, 10)}.jsonl`), line, { encoding: "utf8", mode });
    await append(directory, 0o600);
    await mirrorLogFiles(target => append(target, 0o640));
  });
}

export function pruneSubmissionLogFiles(cutoff: Date, directory = submissionLogDirectory()): Promise<void> {
  return enqueue(async () => {
    await initializeSubmissionLogFiles(directory);
    await pruneDirectory(cutoff, directory);
    await mirrorLogFiles(target => pruneDirectory(cutoff, target));
  });
}

async function pruneDirectory(cutoff: Date, directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(entry.name)) continue;
    const date = entry.name.slice(0, 10);
    const start = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== date) continue;
    // Keep the entire boundary day: even its final submission must reach retention age.
    if (start.getTime() + 86400000 <= cutoff.getTime()) {
      await unlink(join(directory, entry.name));
    }
  }
}
