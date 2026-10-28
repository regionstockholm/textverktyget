import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Application } from "express";
import { Pool } from "pg";
import { getConfiguredDatabaseUrl, getPostgresSslConfig } from "../database/postgres-connection-options.js";
import { useSecureSessionCookie } from "./access-config.js";

const PgSession = connectPgSimple(session);
let sessionPool: Pool | null = null;
let sessionStore: InstanceType<typeof PgSession> | null = null;

export function configureSession(app: Application): void {
  const databaseUrl = getConfiguredDatabaseUrl();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!databaseUrl || !secret || secret.length < 32) {
    throw new Error("Admin and user sessions require DATABASE_URL and SESSION_SECRET (at least 32 characters)");
  }
  const secure = useSecureSessionCookie();
  sessionPool ??= new Pool({ connectionString: databaseUrl, ssl: getPostgresSslConfig(databaseUrl) });
  sessionStore ??= new PgSession({ pool: sessionPool, tableName: "user_sessions", createTableIfMissing: false, pruneSessionInterval: 900 });
  app.use(session({
    store: sessionStore,
    secret,
    name: "sessionId",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: "lax", secure, maxAge: 8 * 60 * 60 * 1000 },
  }));
}

export async function assertSessionStoreReady(): Promise<void> {
  if (sessionPool) await sessionPool.query("SELECT sid FROM user_sessions LIMIT 1");
}

export async function closeSessionStore(): Promise<void> {
  await sessionStore?.close();
  sessionStore = null;
  const pool = sessionPool;
  sessionPool = null;
  await pool?.end();
}
