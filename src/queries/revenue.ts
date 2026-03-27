/**
 * Aggregate revenue queries.
 */

import type Database from "better-sqlite3"

export interface RevenueStats {
  total_revenue_sats: number
  total_settlements: number
  active_credits: number
  active_credit_balance_sats: number
  average_payment_sats: number
}

/**
 * Compute aggregate revenue statistics across all time.
 */
export function getRevenueStats(db: Database.Database): RevenueStats {
  const revenue = db
    .prepare(
      `SELECT COALESCE(SUM(i.amount_sats), 0) AS total_revenue_sats,
              COUNT(*) AS total_settlements,
              CASE WHEN COUNT(*) > 0
                   THEN ROUND(CAST(SUM(i.amount_sats) AS REAL) / COUNT(*))
                   ELSE 0
              END AS average_payment_sats
       FROM settlements s
       JOIN invoices i ON i.payment_hash = s.payment_hash`,
    )
    .get() as { total_revenue_sats: number; total_settlements: number; average_payment_sats: number }

  const credits = db
    .prepare(
      `SELECT COUNT(*) AS active_credits,
              COALESCE(SUM(balance_sats), 0) AS active_credit_balance_sats
       FROM credits
       WHERE balance_sats > 0`,
    )
    .get() as { active_credits: number; active_credit_balance_sats: number }

  return {
    total_revenue_sats: revenue.total_revenue_sats,
    total_settlements: revenue.total_settlements,
    active_credits: credits.active_credits,
    active_credit_balance_sats: credits.active_credit_balance_sats,
    average_payment_sats: revenue.average_payment_sats,
  }
}
