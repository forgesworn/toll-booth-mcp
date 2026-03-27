/**
 * Active session queries.
 */

import type Database from "better-sqlite3"

export interface ActiveSession {
  session_id: string
  payment_hash: string
  balance_sats: number
  deposit_sats: number
  bearer_token: string
  created_at: string
  expires_at: string
}

/**
 * Fetch all currently active IETF Payment sessions (not closed, not expired).
 */
export function getActiveSessions(db: Database.Database): ActiveSession[] {
  return db
    .prepare(
      `SELECT session_id, payment_hash, balance_sats, deposit_sats,
              bearer_token, created_at, expires_at
       FROM sessions
       WHERE closed_at IS NULL
         AND expires_at > datetime('now')
       ORDER BY created_at DESC`,
    )
    .all() as ActiveSession[]
}

export interface CreditBalance {
  payment_hash: string
  balance_sats: number
  balance_usd: number
  created_at: string
  updated_at: string
}

/**
 * Fetch active credit balances above a minimum threshold.
 *
 * @param db - SQLite database connection.
 * @param minBalanceSats - Minimum sats balance to include (default 0).
 */
export function getCredits(db: Database.Database, minBalanceSats = 0): CreditBalance[] {
  return db
    .prepare(
      `SELECT payment_hash, balance_sats, balance_usd, created_at, updated_at
       FROM credits
       WHERE balance_sats >= ?
       ORDER BY balance_sats DESC`,
    )
    .all(minBalanceSats) as CreditBalance[]
}
