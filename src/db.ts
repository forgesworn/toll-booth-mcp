/**
 * Read-only SQLite connection factory.
 *
 * Opens the toll-booth database in read-only mode so the MCP server
 * can never accidentally mutate production data.
 */

import Database from "better-sqlite3"

/**
 * Open a read-only connection to the toll-booth SQLite database.
 *
 * @param dbPath - Filesystem path to the SQLite file.
 * @returns A better-sqlite3 Database instance opened in read-only mode.
 */
export function openReadOnly(dbPath: string): Database.Database {
  return new Database(dbPath, { readonly: true, fileMustExist: true })
}

/**
 * Create an in-memory database seeded with the toll-booth schema.
 * Used for testing only.
 */
export function createTestDb(): Database.Database {
  const db = new Database(":memory:")
  db.exec(SCHEMA)
  return db
}

/** Toll-booth DDL matching the production schema. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS credits (
  payment_hash TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  balance_sats INTEGER NOT NULL DEFAULT 0,
  balance_usd INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  payment_hash TEXT PRIMARY KEY,
  bolt11 TEXT NOT NULL,
  amount_sats INTEGER NOT NULL,
  macaroon TEXT NOT NULL,
  status_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  client_ip TEXT
);

CREATE TABLE IF NOT EXISTS settlements (
  payment_hash TEXT PRIMARY KEY,
  settlement_secret TEXT,
  settled_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS claims (
  payment_hash TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  lease_expires_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  payment_hash TEXT NOT NULL,
  balance_sats INTEGER NOT NULL DEFAULT 0,
  deposit_sats INTEGER NOT NULL DEFAULT 0,
  return_invoice TEXT,
  bearer_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  closed_at TEXT,
  refund_preimage TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_bearer ON sessions(bearer_token);
`
