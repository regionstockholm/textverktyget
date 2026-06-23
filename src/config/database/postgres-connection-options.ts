import type { PoolConfig } from "pg";
import { config } from "../app-config.js";

export const UNCONFIGURED_DATABASE_URL =
  "postgresql://invalid:invalid@127.0.0.1:1/invalid";

export function getConfiguredDatabaseUrl(): string {
  return config.database.url || process.env.DATABASE_URL || "";
}

export function requireConfiguredDatabaseUrl(): string {
  const databaseUrl = getConfiguredDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Postgres connection");
  }

  return databaseUrl;
}

export function getPostgresSslConfig(
  databaseUrl: string,
): PoolConfig["ssl"] {
  let sslMode = (config.database.sslMode || "").toLowerCase();

  if (!sslMode) {
    try {
      const parsed = new URL(databaseUrl);
      const urlMode = parsed.searchParams.get("sslmode");
      if (urlMode) {
        sslMode = urlMode.toLowerCase();
      }
    } catch {
      // Ignore URL parsing errors and fall back to defaults.
    }
  }

  if (!sslMode) {
    sslMode = "disable";
  }

  if (sslMode === "true" || sslMode === "on" || sslMode === "1") {
    sslMode = "require";
  }

  if (
    sslMode === "disable" ||
    sslMode === "false" ||
    sslMode === "off" ||
    sslMode === "0"
  ) {
    return undefined;
  }

  const override = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  const insecureDefaultModes = new Set(["require", "prefer", "allow"]);
  const defaultRejectUnauthorized = !insecureDefaultModes.has(sslMode);
  const rejectUnauthorized =
    override === "true"
      ? true
      : override === "false"
        ? false
        : defaultRejectUnauthorized;

  return { rejectUnauthorized };
}

export function maskDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return "[invalid DATABASE_URL]";
  }
}
