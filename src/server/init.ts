import { shutdown } from "./shutdown.js";
import { startup } from "./startup.js";
import type { Server } from "node:http";

const STARTUP_ERROR_EXIT_CODE = 4;
const GENERAL_ERROR_EXIT_CODE = 1;
let server: Server | undefined;

function exitAfterShutdown(reason: Parameters<typeof shutdown>[0], code: number): void {
  shutdown(reason, server)
    .catch((error) => {
      console.error("Error during shutdown:", error);
    })
    .finally(() => {
      process.exit(code);
    });
}

function setupProcessHandlers(): void {
  process.on("SIGINT", () => exitAfterShutdown("SIGINT", 0));
  process.on("SIGTERM", () => exitAfterShutdown("SIGTERM", 0));
  process.on("uncaughtException", (error: Error) => {
    console.error("Uncaught exception:", error);
    exitAfterShutdown("uncaughtException", GENERAL_ERROR_EXIT_CODE);
  });
  process.on("unhandledRejection", (reason: unknown) => {
    console.error("Unhandled promise rejection:", reason);
    exitAfterShutdown("unhandledRejection", GENERAL_ERROR_EXIT_CODE);
  });
}

export async function init(): Promise<void> {
  try {
    setupProcessHandlers();
    server = await startup(process.env.PORT);
  } catch (error) {
    console.error("Server initialization failed:", error);
    process.exit(STARTUP_ERROR_EXIT_CODE);
  }
}
