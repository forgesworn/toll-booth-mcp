/**
 * Service / endpoint queries.
 *
 * toll-booth does not store per-endpoint metadata in SQLite —
 * it relies on in-memory config. Instead we derive service-level stats
 * from invoice pricing tiers (amount_sats buckets).
 */

import type Database from "better-sqlite3"

export interface ServiceTier {
  amount_sats: number
  payment_count: number
  total_sats: number
  average_sats: number
}

/**
 * Group settled invoices by pricing tier (amount_sats).
 *
 * Each distinct amount_sats value represents a pricing tier in the booth config.
 */
export function getServiceTiers(db: Database.Database): ServiceTier[] {
  return db
    .prepare(
      `SELECT i.amount_sats,
              COUNT(*) AS payment_count,
              SUM(i.amount_sats) AS total_sats,
              ROUND(AVG(i.amount_sats)) AS average_sats
       FROM invoices i
       JOIN settlements s ON s.payment_hash = i.payment_hash
       GROUP BY i.amount_sats
       ORDER BY total_sats DESC`,
    )
    .all() as ServiceTier[]
}
