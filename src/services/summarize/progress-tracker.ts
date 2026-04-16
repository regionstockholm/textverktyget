export type SummarizeStage =
  | "queued"
  | "analysis"
  | "rewrite_draft"
  | "task_execution"
  | "task_shaping"
  | "quality_evaluation"
  | "quality_repair"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export interface SummarizeProgressSnapshot {
  processId: string;
  stage: SummarizeStage;
  message: string;
  updatedAt: string;
  isTerminal: boolean;
}

type ProgressListener = (snapshot: SummarizeProgressSnapshot) => void;

interface ProgressEntry {
  processId: string;
  stage: SummarizeStage;
  messageOverride?: string;
  updatedAtMs: number;
}

const PROGRESS_TTL_MS = 10 * 60 * 1000;

const STAGE_MESSAGES: Record<SummarizeStage, string> = {
  queued: "Ställer i kö...",
  analysis: "Sammanfattar det viktigaste...",
  rewrite_draft: "Tar fram omskrivningsutkast...",
  task_execution: "Genomför uppgiften...",
  task_shaping: "Förfinar struktur och ordning...",
  quality_evaluation: "Granskar resultatet...",
  quality_repair: "Gör justeringar...",
  finalizing: "Slutför bearbetningen...",
  completed: "Klart.",
  failed: "Bearbetningen misslyckades.",
  cancelled: "Bearbetningen avbröts.",
};

const terminalStages: Set<SummarizeStage> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

const progressByProcessId = new Map<string, ProgressEntry>();
const listenersByProcessId = new Map<string, Set<ProgressListener>>();

function cleanupExpiredEntries(nowMs: number): void {
  for (const [processId, entry] of progressByProcessId.entries()) {
    if (nowMs - entry.updatedAtMs > PROGRESS_TTL_MS) {
      progressByProcessId.delete(processId);
      listenersByProcessId.delete(processId);
    }
  }
}

function sanitizeProcessId(processId: string): string {
  return processId.trim();
}

function buildSnapshot(entry: ProgressEntry): SummarizeProgressSnapshot {
  return {
    processId: entry.processId,
    stage: entry.stage,
    message: entry.messageOverride || STAGE_MESSAGES[entry.stage],
    updatedAt: new Date(entry.updatedAtMs).toISOString(),
    isTerminal: terminalStages.has(entry.stage),
  };
}

function notifyListeners(snapshot: SummarizeProgressSnapshot): void {
  const listeners = listenersByProcessId.get(snapshot.processId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // Ignore listener errors to keep progress tracking stable
    }
  }
}

export function setSummarizeProgress(
  processId: string,
  stage: SummarizeStage,
  messageOverride?: string,
): void {
  const normalizedProcessId = sanitizeProcessId(processId);
  if (!normalizedProcessId) {
    return;
  }

  const nowMs = Date.now();
  cleanupExpiredEntries(nowMs);
  const existing = progressByProcessId.get(normalizedProcessId);
  const normalizedOverride =
    typeof messageOverride === "string" && messageOverride.trim().length > 0
      ? messageOverride.trim()
      : undefined;

  if (
    existing &&
    existing.stage === stage &&
    existing.messageOverride === normalizedOverride
  ) {
    return;
  }

  const entry: ProgressEntry = {
    processId: normalizedProcessId,
    stage,
    messageOverride: normalizedOverride,
    updatedAtMs: nowMs,
  };
  progressByProcessId.set(normalizedProcessId, entry);
  notifyListeners(buildSnapshot(entry));
}

export function getSummarizeProgress(
  processId: string,
): SummarizeProgressSnapshot | null {
  const normalizedProcessId = sanitizeProcessId(processId);
  if (!normalizedProcessId) {
    return null;
  }

  const nowMs = Date.now();
  cleanupExpiredEntries(nowMs);
  const entry = progressByProcessId.get(normalizedProcessId);
  if (!entry) {
    return null;
  }

  return buildSnapshot(entry);
}

export function subscribeSummarizeProgress(
  processId: string,
  listener: ProgressListener,
): () => void {
  const normalizedProcessId = sanitizeProcessId(processId);
  if (!normalizedProcessId) {
    return () => {};
  }

  const listeners =
    listenersByProcessId.get(normalizedProcessId) ||
    new Set<ProgressListener>();
  listeners.add(listener);
  listenersByProcessId.set(normalizedProcessId, listeners);

  return () => {
    const currentListeners = listenersByProcessId.get(normalizedProcessId);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      listenersByProcessId.delete(normalizedProcessId);
    }
  };
}
