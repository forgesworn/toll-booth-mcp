/**
 * Payment history queries.
 */

import type Database from "better-sqlite3"

export interface DailyPayment {
  date: string
  total_sats: number
  count: number
}

export interface PaymentHistorySummary {
  days: DailyPayment[]
  total_sats: number
  average_sats: number
  peak_day: string | null
  peak_sats: number
  period_start: string
  period_end: string
}

/**
 * Aggregate daily payment totals from settled invoices.
 *
 * @param db - SQLite database connection.
 * @param days - Number of days to look back (default 30).
 */
export function getPaymentHistory(db: Database.Database, days = 30): PaymentHistorySummary {
  const rows = db
    .prepare(
      `SELECT date(s.settled_at) AS date,
              SUM(i.amount_sats) AS total_sats,
              COUNT(*) AS count
       FROM settlements s
       JOIN invoices i ON i.payment_hash = s.payment_hash
       WHERE s.settled_at >= datetime('now', ?)
       GROUP BY date(s.settled_at)
       ORDER BY date(s.settled_at) ASC`,
    )
    .all(`-${days} days`) as DailyPayment[]

  const totalSats = rows.reduce((sum, r) => sum + r.total_sats, 0)
  const averageSats = rows.length > 0 ? Math.round(totalSats / rows.length) : 0

  let peakDay: string | null = null
  let peakSats = 0
  for (const row of rows) {
    if (row.total_sats > peakSats) {
      peakSats = row.total_sats
      peakDay = row.date
    }
  }

  return {
    days: rows,
    total_sats: totalSats,
    average_sats: averageSats,
    peak_day: peakDay,
    peak_sats: peakSats,
    period_start: rows.length > 0 ? rows[0].date : "",
    period_end: rows.length > 0 ? rows[rows.length - 1].date : "",
  }
}

export interface RecentPayment {
  payment_hash: string
  amount_sats: number
  settled_at: string
  created_at: string
}

/**
 * Fetch the most recent settled payments.
 *
 * @param db - SQLite database connection.
 * @param limit - Maximum number of results (default 20).
 */
export function getRecentPayments(db: Database.Database, limit = 20): RecentPayment[] {
  return db
    .prepare(
      `SELECT s.payment_hash,
              i.amount_sats,
              s.settled_at,
              i.created_at
       FROM settlements s
       JOIN invoices i ON i.payment_hash = s.payment_hash
       ORDER BY s.settled_at DESC
       LIMIT ?`,
    )
    .all(limit) as RecentPayment[]
}
