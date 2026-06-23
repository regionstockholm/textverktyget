import { closeDatabase } from "../config/database/db-connection.js";
import { disconnectPrismaClient } from "../config/database/prisma-client.js";

type ShutdownReason =
  | "SIGINT"
  | "SIGTERM"
  | "uncaughtException"
  | "unhandledRejection"
  | "manual"
  | "error";

let isShuttingDown = false;

async function closeDatabaseConnections(): Promise<void> {
  await Promise.allSettled([closeDatabase(), disconnectPrismaClient()]);
}

export async function shutdown(reason: ShutdownReason): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Shutting down server (reason: ${reason})...`);

  await closeDatabaseConnections();
}
