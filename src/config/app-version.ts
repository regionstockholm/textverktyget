import { readFileSync } from "node:fs";
import { join } from "node:path";

const FALLBACK_VERSION = "unknown";

let cachedVersion: string | null = null;

export function getAppVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const packagePath = join(process.cwd(), "package.json");
    const content = readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(content) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
      cachedVersion = parsed.version.trim();
      return cachedVersion;
    }
  } catch {
  }

  cachedVersion = FALLBACK_VERSION;
  return cachedVersion;
}
