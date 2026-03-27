import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { createTestDb } from "../../src/db.js"
import { getPaymentHistory, getRecentPayments } from "../../src/queries/payments.js"

let db: Database.Database

function seedPayments(db: Database.Database): void {
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (payment_hash, bolt11, amount_sats, macaroon, status_token, created_at)
     VALUES (?, ?, ?, 'mac', 'tok', ?)`,
  )
  const insertSettlement = db.prepare(
    `INSERT INTO settlements (payment_hash, settled_at) VALUES (?, ?)`,
  )

  // Day 1: 2 payments totalling 150 sats
  insertInvoice.run("hash1", "lnbc1", 100, "2026-03-01 10:00:00")
  insertSettlement.run("hash1", "2026-03-01 10:05:00")
  insertInvoice.run("hash2", "lnbc2", 50, "2026-03-01 14:00:00")
  insertSettlement.run("hash2", "2026-03-01 14:05:00")

  // Day 2: 1 payment of 200 sats
  insertInvoice.run("hash3", "lnbc3", 200, "2026-03-02 09:00:00")
  insertSettlement.run("hash3", "2026-03-02 09:05:00")

  // Day 3: 1 payment of 75 sats
  insertInvoice.run("hash4", "lnbc4", 75, "2026-03-03 12:00:00")
  insertSettlement.run("hash4", "2026-03-03 12:05:00")
}

beforeEach(() => {
  db = createTestDb()
  seedPayments(db)
})

describe("getPaymentHistory", () => {
  it("returns daily aggregates", () => {
    const result = getPaymentHistory(db, 365)
    expect(result.days).toHaveLength(3)
    expect(result.days[0].date).toBe("2026-03-01")
    expect(result.days[0].total_sats).toBe(150)
    expect(result.days[0].count).toBe(2)
    expect(result.days[1].date).toBe("2026-03-02")
    expect(result.days[1].total_sats).toBe(200)
    expect(result.days[2].date).toBe("2026-03-03")
    expect(result.days[2].total_sats).toBe(75)
  })

  it("computes correct summary statistics", () => {
    const result = getPaymentHistory(db, 365)
    expect(result.total_sats).toBe(425)
    expect(result.average_sats).toBe(Math.round(425 / 3))
    expect(result.peak_day).toBe("2026-03-02")
    expect(result.peak_sats).toBe(200)
    expect(result.period_start).toBe("2026-03-01")
    expect(result.period_end).toBe("2026-03-03")
  })

  it("returns empty summary when no data", () => {
    const emptyDb = createTestDb()
    const result = getPaymentHistory(emptyDb, 30)
    expect(result.days).toHaveLength(0)
    expect(result.total_sats).toBe(0)
    expect(result.average_sats).toBe(0)
    expect(result.peak_day).toBeNull()
    expect(result.peak_sats).toBe(0)
    expect(result.period_start).toBe("")
    expect(result.period_end).toBe("")
  })
})

describe("getRecentPayments", () => {
  it("returns payments in reverse chronological order", () => {
    const result = getRecentPayments(db, 10)
    expect(result).toHaveLength(4)
    expect(result[0].payment_hash).toBe("hash4")
    expect(result[0].amount_sats).toBe(75)
    expect(result[3].payment_hash).toBe("hash1")
  })

  it("respects the limit parameter", () => {
    const result = getRecentPayments(db, 2)
    expect(result).toHaveLength(2)
    expect(result[0].payment_hash).toBe("hash4")
    expect(result[1].payment_hash).toBe("hash3")
  })

  it("returns correct fields", () => {
    const result = getRecentPayments(db, 1)
    expect(result[0]).toHaveProperty("payment_hash")
    expect(result[0]).toHaveProperty("amount_sats")
    expect(result[0]).toHaveProperty("settled_at")
    expect(result[0]).toHaveProperty("created_at")
  })
})
