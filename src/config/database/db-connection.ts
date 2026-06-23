/**
 * Postgres Database Connection Module
 * Handles Postgres connection setup and database initialization
 * @module config/database/db-connection
 */

import { Pool, type PoolConfig } from "pg";
import { ensureDatabaseStructure } from "./db-schema.js";
import {
  getPostgresSslConfig,
  maskDatabaseUrl,
  requireConfiguredDatabaseUrl,
} from "./postgres-connection-options.js";

/**
 * Maximum number of retry attempts for database operations
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Database pool - shared across the application
 */
let dbInstance: Pool | null = null;

/**
 * Database initialization promise to prevent race conditions
 */
let initializationPromise: Promise<Pool> | null = null;

/**
 * Creates Postgres pool configuration
 */
function createPoolConfig(): PoolConfig {
  const databaseUrl = requireConfiguredDatabaseUrl();
  const ssl = getPostgresSslConfig(databaseUrl);

  console.log(
    `[Database] Using Postgres connection: ${maskDatabaseUrl(databaseUrl)}`,
  );

  return {
    connectionString: databaseUrl,
    ssl,
  };
}

/**
 * Initializes the Postgres database connection
 * @returns Promise<Pool> Database pool
 * @throws {Error} If database initialization fails
 */
async function initializeDatabase(): Promise<Pool> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      const poolConfig = createPoolConfig();
      let attempts = 0;

      while (attempts < MAX_RETRY_ATTEMPTS) {
        let pool: Pool | null = null;

        try {
          console.log(
            `[Database] Attempt ${attempts + 1} to connect to Postgres`,
          );

          pool = new Pool(poolConfig);

          const client = await pool.connect();
          try {
            await client.query("SELECT 1 as test");
          } finally {
            client.release();
          }

          console.log("[Database] Successfully connected to Postgres database");

          // Initialize database structure
          await ensureDatabaseStructure(pool);
          console.log("[Database] Database structure initialization completed");

          dbInstance = pool;
          return pool;
        } catch (error) {
          attempts++;
          console.error(
            `[Database] Connection attempt ${attempts} failed:`,
            error,
          );

          if (pool) {
            await pool.end().catch(() => undefined);
          }

          if (attempts >= MAX_RETRY_ATTEMPTS) {
            console.error("[Database] All connection attempts failed");
            throw new Error(
              `Failed to connect to Postgres database after ${MAX_RETRY_ATTEMPTS} attempts: ${error}`,
            );
          }

          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw new Error("Database initialization failed");
    })().finally(() => {
      initializationPromise = null;
    });
  }

  return initializationPromise;
}

/**
 * Gets the database pool, initializing if necessary
 * @returns Promise<Pool> Database pool
 */
export async function getDatabase(): Promise<Pool> {
  if (!dbInstance) {
    dbInstance = await initializeDatabase();
  }
  return dbInstance;
}

/**
 * Closes the database connection pool gracefully
 * @returns Promise<void>
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.end();
      console.log("[Database] Postgres database connection closed");
    } catch (error) {
      console.error("[Database] Error closing database connection:", error);
    } finally {
      dbInstance = null;
    }
  }
}

/**
 * Tests the database connection
 * @returns Promise<boolean> True if connection is working
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = await getDatabase();
    await db.query("SELECT 1 as test");
    console.log("[Database] Connection test successful");
    return true;
  } catch (error) {
    console.error("[Database] Connection test failed:", error);
    return false;
  }
}

export default getDatabase;
