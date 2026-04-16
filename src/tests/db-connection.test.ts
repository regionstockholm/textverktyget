import test from "node:test";
import assert from "node:assert/strict";
import { getDatabase, testConnection } from "../config/database/db-connection.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";

test(
  "connects to Postgres and initializes schema",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    if (!(await ensureDatabaseAvailable(t))) {
      return;
    }

    const isConnected = await testConnection();
    assert.equal(isConnected, true);

    const db = await getDatabase();
    const result = await db.query(
      "SELECT to_regclass('public.text_quality_control') AS table_name",
    );

    assert.equal(result.rows[0]?.table_name, "text_quality_control");
  },
);
