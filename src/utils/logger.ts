export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type ProcessStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface LogContext {
  requestId?: string;
  processId?: string;
  processStatus?: ProcessStatus;
  meta?: Record<string, unknown>;
}

interface LogEntry extends LogContext {
  timestamp: string;
  level: LogLevel;
  event: string;
  pid: number;
}

const LOG_FORMAT = process.env.LOG_FORMAT === "json" ? "json" : "plain";
const DEBUG_ENABLED =
  process.env.LOG_LEVEL?.toLowerCase() === "debug" ||
  process.env.DEBUG_LOGS === "true";

function shouldLog(level: LogLevel): boolean {
  if (level === "DEBUG") {
    return DEBUG_ENABLED;
  }
  return true;
}

function toEntry(level: LogLevel, event: string, context?: LogContext): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    pid: process.pid,
    requestId: context?.requestId,
    processId: context?.processId,
    processStatus: context?.processStatus,
    meta: context?.meta,
  };
}

function write(level: LogLevel, event: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry = toEntry(level, event, context);

  if (LOG_FORMAT === "json") {
    const output = JSON.stringify(entry);
    if (level === "ERROR") {
      console.error(output);
    } else if (level === "WARN") {
      console.warn(output);
    } else {
      console.log(output);
    }
    return;
  }

  const ids = [entry.requestId, entry.processId].filter(Boolean).join(" ");
  const status = entry.processStatus ? ` status=${entry.processStatus}` : "";
  const meta =
    entry.meta && Object.keys(entry.meta).length > 0
      ? ` meta=${JSON.stringify(entry.meta)}`
      : "";
  const message = `[${entry.level}] ${entry.event}${ids ? ` ${ids}` : ""}${status}${meta}`;

  if (level === "ERROR") {
    console.error(message);
  } else if (level === "WARN") {
    console.warn(message);
  } else {
    console.log(message);
  }
}

export const logger = {
  debug(event: string, context?: LogContext): void {
    write("DEBUG", event, context);
  },
  info(event: string, context?: LogContext): void {
    write("INFO", event, context);
  },
  warn(event: string, context?: LogContext): void {
    write("WARN", event, context);
  },
  error(event: string, context?: LogContext): void {
    write("ERROR", event, context);
  },
};
