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

export function appendSubmissionLog(submission: Submission, directory = submissionLogDirectory()): Promise<void> {
  return enqueue(async () => {
    await initializeSubmissionLogFiles(directory);
    const time = submission.createdAt.toISOString();
    const line = JSON.stringify({ username: submission.username, time_utc: time, text: submission.text }) + "\n";
    await appendFile(join(directory, `${time.slice(0, 10)}.jsonl`), line, { encoding: "utf8", mode: 0o600 });
  });
}

export function pruneSubmissionLogFiles(cutoff: Date, directory = submissionLogDirectory()): Promise<void> {
  return enqueue(async () => {
    await initializeSubmissionLogFiles(directory);
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
  });
}
