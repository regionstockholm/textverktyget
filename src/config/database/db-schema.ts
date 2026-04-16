/**
 * Postgres Database Schema Module
 * Handles database schema creation and validation for Postgres
 * @module config/database/db-schema
 */

import type { Pool } from "pg";

/**
 * Maximum number of retry attempts for database operations
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Checks if a table exists in the Postgres database
 * @param db Postgres database pool
 * @param tableName Name of the table to check
 * @returns Promise<boolean> True if table exists
 */
async function tableExists(db: Pool, tableName: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [tableName],
    );
    return result.rows[0]?.exists === true;
  } catch (error) {
    console.error(
      `[Database] Error checking if table ${tableName} exists:`,
      error,
    );
    return false;
  }
}

/**
 * Creates the text_quality_control table with Postgres-compatible syntax
 * @param db Postgres database pool
 */
async function createTextQualityTable(db: Pool): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS text_quality_control (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      original_text TEXT NOT NULL,
      processed_text TEXT NOT NULL,
      prompt_used TEXT,
      processing_options TEXT,
      rewrite_plan_draft TEXT,
      score DOUBLE PRECISION,
      iteration INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  try {
    await db.query(createTableQuery);
    console.log("[Database] text_quality_control table created successfully");
  } catch (error) {
    console.error(
      "[Database] Error creating text_quality_control table:",
      error,
    );
    throw error;
  }
}

/**
 * Runs database migrations for text_quality_control table
 * This runs independently of table creation to handle existing databases
 * @param db Postgres database pool
 */
async function migrateTextQualityTable(db: Pool): Promise<void> {
  console.log(
    "[Database] Running migrations for text_quality_control table...",
  );

  // Migration 1: Add processing_options column (Bug 4.2 fix)
  try {
    await db.query(`
      ALTER TABLE text_quality_control
      ADD COLUMN IF NOT EXISTS processing_options TEXT
    `);
    console.log("[Database] ✅ Migration: Added processing_options column");
  } catch (alterError: unknown) {
    console.error("[Database] ⚠️ Migration error:", alterError);
    // Don't throw - allow other migrations to run
  }

  // Migration 2: Add rewrite_plan_draft column for temporary rewrite-order guidance
  try {
    await db.query(`
      ALTER TABLE text_quality_control
      ADD COLUMN IF NOT EXISTS rewrite_plan_draft TEXT
    `);
    console.log("[Database] ✅ Migration: Added rewrite_plan_draft column");
  } catch (alterError: unknown) {
    console.error("[Database] ⚠️ Migration error:", alterError);
    // Don't throw - allow other migrations to run
  }

  console.log("[Database] Migrations completed");
}

/**
 * Creates indexes for the text_quality_control table
 * @param db Postgres database pool
 */
async function createTextQualityIndexes(db: Pool): Promise<void> {
  const indexes = [
    {
      name: "idx_text_quality_session",
      query:
        "CREATE INDEX IF NOT EXISTS idx_text_quality_session ON text_quality_control(session_id)",
    },
    {
      name: "idx_text_quality_status",
      query:
        "CREATE INDEX IF NOT EXISTS idx_text_quality_status ON text_quality_control(status)",
    },
    {
      name: "idx_text_quality_created_at",
      query:
        "CREATE INDEX IF NOT EXISTS idx_text_quality_created_at ON text_quality_control(created_at)",
    },
  ];

  for (const index of indexes) {
    try {
      await db.query(index.query);
      console.log(`[Database] Index ${index.name} created successfully`);
    } catch (error) {
      console.error(`[Database] Error creating index ${index.name}:`, error);
      throw error;
    }
  }
}

/**
 * Verifies that the table was created with correct structure
 * @param db Postgres database pool
 */
async function verifyTableStructure(db: Pool): Promise<void> {
  try {
    const tableInfo = await db.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'text_quality_control'
       ORDER BY ordinal_position`,
    );

    if (tableInfo.rows.length === 0) {
      throw new Error(
        "text_quality_control table structure verification failed",
      );
    }

    console.log(
      `[Database] text_quality_control table has ${tableInfo.rows.length} columns`,
    );

    // Log column information for debugging
    tableInfo.rows.forEach((column: any) => {
      console.log(`[Database] Column: ${column.column_name} (${column.data_type})`);
    });
  } catch (error) {
    console.error("[Database] Error verifying table structure:", error);
    throw error;
  }
}

/**
 * Lists all indexes for the text_quality_control table
 * @param db Postgres database pool
 */
async function verifyIndexes(db: Pool): Promise<void> {
  try {
    const indexes = await db.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'text_quality_control'`,
    );

    console.log(
      `[Database] Found ${indexes.rows.length} indexes for text_quality_control table:`,
    );

    indexes.rows.forEach((index: any, i: number) => {
      console.log(
        `[Database] Index ${i + 1}: ${index.indexname} - ${index.indexdef}`,
      );
    });
  } catch (error) {
    console.error("[Database] Error verifying indexes:", error);
    throw error;
  }
}

/**
 * Ensures all required database tables and indexes exist
 * @param db Postgres database pool
 */
export async function ensureDatabaseStructure(db: Pool): Promise<void> {
  console.log(
    `[Database] Starting database structure initialization`,
  );

  let attempts = 0;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      // Check if text_quality_control table already exists
      const tableAlreadyExists = await tableExists(db, "text_quality_control");

      if (tableAlreadyExists) {
        console.log(
          "[Database] Table text_quality_control already exists, skipping creation",
        );
      } else {
        console.log(
          "[Database] Table text_quality_control does not exist, creating now...",
        );
        await createTextQualityTable(db);
      }

      // Run migrations (for existing databases that need schema updates)
      await migrateTextQualityTable(db);

      // Create indexes (CREATE INDEX IF NOT EXISTS will handle duplicates)
      await createTextQualityIndexes(db);

      // Verify table was created successfully
      await verifyTableStructure(db);

      // Verify indexes were created
      await verifyIndexes(db);

      console.log(
        `[Database] Database structure initialization completed`,
      );
      return;
    } catch (error) {
      attempts++;
      console.error(
        `[Database] Structure initialization attempt ${attempts} failed:`,
        error,
      );

      if (attempts >= MAX_RETRY_ATTEMPTS) {
        console.error(
          "[Database] All database structure initialization attempts failed",
        );
        throw new Error(
          `Failed to initialize database structure after ${MAX_RETRY_ATTEMPTS} attempts: ${error}`,
        );
      }

      // Wait before retrying
      const delay = Math.pow(2, attempts) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
