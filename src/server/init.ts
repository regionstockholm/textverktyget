import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { shutdown } from "./shutdown.js";
import { startup } from "./startup.js";

const STARTUP_ERROR_EXIT_CODE = 4;
const GENERAL_ERROR_EXIT_CODE = 1;
const UPLOAD_DIR_PERMISSIONS = 0o750;

type CommandLineArgs = {
  port?: string;
};

function parseCommandLineArgs(): CommandLineArgs {
  const args: CommandLineArgs = {};
  const processArgs = process.argv.slice(2);

  for (let index = 0; index < processArgs.length; index += 1) {
    const arg = processArgs[index];
    if ((arg === "--port" || arg === "-p") && processArgs[index + 1]) {
      args.port = processArgs[index + 1];
      index += 1;
    }
  }

  return args;
}

function getPort(args: CommandLineArgs): number | undefined {
  const rawPort = args.port || process.env.PORT;
  if (!rawPort) {
    return undefined;
  }

  const port = Number(rawPort);
  return Number.isInteger(port) ? port : undefined;
}

function exitAfterShutdown(reason: Parameters<typeof shutdown>[0], code: number): void {
  shutdown(reason)
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

function getUploadsDirectoryPath(): string {
  const fileName = fileURLToPath(import.meta.url);
  const directoryName = path.dirname(fileName);
  return path.join(path.dirname(directoryName), "uploads");
}

export async function setupUploadsDirectory(): Promise<string> {
  const uploadsDir = getUploadsDirectoryPath();
  await fs.mkdir(uploadsDir, {
    recursive: true,
    mode: UPLOAD_DIR_PERMISSIONS,
  });

  const stats = await fs.stat(uploadsDir);
  if (!stats.isDirectory()) {
    throw new Error(`Path exists but is not a directory: ${uploadsDir}`);
  }

  return uploadsDir;
}

export function logEnvironmentInfo(): void {
  console.log("[Environment] Running in STANDARD (Production) mode");
}

export async function init(): Promise<void> {
  try {
    const args = parseCommandLineArgs();
    const port = getPort(args);

    setupProcessHandlers();
    await setupUploadsDirectory();
    await startup(port);
    logEnvironmentInfo();
  } catch (error) {
    console.error("Server initialization failed:", error);
    process.exit(STARTUP_ERROR_EXIT_CODE);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  init().catch((error: Error) => {
    console.error("Unhandled error during initialization:", error);
    process.exit(GENERAL_ERROR_EXIT_CODE);
  });
}
