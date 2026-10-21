import { closeDatabase } from "../config/database/db-connection.js";
import { disconnectPrismaClient } from "../config/database/prisma-client.js";
import { closeSessionStore } from "../config/security/session-config.js";
import { stopSubmissionLogging } from "../services/submission-log-service.js";
import type { Server } from "node:http";

type ShutdownReason =
  | "SIGINT"
  | "SIGTERM"
  | "uncaughtException"
  | "unhandledRejection"
  | "manual"
  | "error";

let shutdownPromise: Promise<void> | undefined;

async function closeDatabaseConnections(): Promise<void> {
  stopSubmissionLogging();
  await Promise.allSettled([closeDatabase(), disconnectPrismaClient(), closeSessionStore()]);
}

export function shutdown(reason: ShutdownReason, server?: Server): Promise<void> {
  return shutdownPromise ??= (async () => {
    console.log(`Shutting down server (reason: ${reason})...`);
    if (server) {
      await new Promise<void>(resolve => {
        // shortcut: drain HTTP for 120 seconds; increase with Compose's grace period for longer jobs.
        const deadline = setTimeout(() => {
          server.closeAllConnections();
          resolve();
        }, 120000);
        server.close(() => { clearTimeout(deadline); resolve(); });
      });
    }
    await closeDatabaseConnections();
  })();
}
