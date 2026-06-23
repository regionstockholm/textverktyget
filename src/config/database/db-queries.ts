/**
 * Postgres Database Query Module
 * Provides utility functions for executing Postgres database queries
 * @module config/database/db-queries
 */

import type { Pool, PoolClient } from "pg";

export type DatabaseClient = Pool | PoolClient;

/**
 * Executes a SELECT query and returns a single row
 * @param db Postgres database client
 * @param query SQL SELECT query
 * @param params Query parameters (optional)
 * @returns Single row result or null if no results
 */
export async function executeQuerySingle(
  db: DatabaseClient,
  query: string,
  params: unknown[] = [],
): Promise<any> {
  if (!db) {
    throw new Error("Database instance is required");
  }

  if (!query || typeof query !== "string") {
    throw new Error("Valid SQL query string is required");
  }

  try {
    console.log(
      `[Database] Executing single query: ${query.substring(0, 100)}...`,
    );
    const result = await db.query(query, params);
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("[Database] Error executing single query:", error);
    throw error;
  }
}

/**
 * Executes an INSERT query and returns the inserted row ID
 * @param db Postgres database client
 * @param query SQL INSERT query
 * @param params Query parameters (optional)
 * @returns The ID of the inserted row
 */
export async function executeInsert(
  db: DatabaseClient,
  query: string,
  params: unknown[] = [],
): Promise<number> {
  if (!db) {
    throw new Error("Database instance is required");
  }

  if (!query || typeof query !== "string") {
    throw new Error("Valid SQL query string is required");
  }

  if (!query.trim().toUpperCase().startsWith("INSERT")) {
    throw new Error("Query must be an INSERT statement");
  }

  try {
    console.log(
      `[Database] Executing insert query: ${query.substring(0, 100)}...`,
    );
    const result = await db.query(query, params);
    const id = result.rows[0]?.id;

    if (typeof id !== "number") {
      throw new Error("Insert query did not return a valid ID");
    }

    return id;
  } catch (error) {
    console.error("[Database] Error executing insert query:", error);
    throw error;
  }
}

/**
 * Executes an UPDATE query and returns the number of affected rows
 * @param db Postgres database client
 * @param query SQL UPDATE query
 * @param params Query parameters (optional)
 * @returns Number of rows affected
 */
export async function executeUpdate(
  db: DatabaseClient,
  query: string,
  params: unknown[] = [],
): Promise<number> {
  if (!db) {
    throw new Error("Database instance is required");
  }

  if (!query || typeof query !== "string") {
    throw new Error("Valid SQL query string is required");
  }

  if (!query.trim().toUpperCase().startsWith("UPDATE")) {
    throw new Error("Query must be an UPDATE statement");
  }

  try {
    console.log(
      `[Database] Executing update query: ${query.substring(0, 100)}...`,
    );
    const result = await db.query(query, params);

    return result.rowCount || 0;
  } catch (error) {
    console.error("[Database] Error executing update query:", error);
    throw error;
  }
}

/**
 * Executes a DELETE query and returns the number of affected rows
 * @param db Postgres database client
 * @param query SQL DELETE query
 * @param params Query parameters (optional)
 * @returns Number of rows affected
 */
export async function executeDelete(
  db: DatabaseClient,
  query: string,
  params: unknown[] = [],
): Promise<number> {
  if (!db) {
    throw new Error("Database instance is required");
  }

  if (!query || typeof query !== "string") {
    throw new Error("Valid SQL query string is required");
  }

  if (!query.trim().toUpperCase().startsWith("DELETE")) {
    throw new Error("Query must be a DELETE statement");
  }

  try {
    console.log(
      `[Database] Executing delete query: ${query.substring(0, 100)}...`,
    );
    const result = await db.query(query, params);

    return result.rowCount || 0;
  } catch (error) {
    console.error("[Database] Error executing delete query:", error);
    throw error;
  }
}
