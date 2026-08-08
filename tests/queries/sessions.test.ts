import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { createTestDb } from "../../src/db.js"
import { getActiveSessions } from "../../src/queries/sessions.js"

let db: Database.Database

function seedSessions(db: Database.Database): void {
  const insert = db.prepare(
    `INSERT INTO sessions (session_id, payment_hash, balance_sats, deposit_sats,
                           bearer_token, created_at, expires_at, closed_at, refund_preimage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  // Active session
  insert.run(
    "sess-active", "hash1", 500, 1000, "live-bearer-token",
    "2026-03-01 10:00:00", "2999-03-02 10:00:00", null, "preimage1",
  )
  // Expired session
  insert.run(
    "sess-expired", "hash2", 0, 1000, "expired-bearer-token",
    "2026-03-01 10:00:00", "2026-03-01 11:00:00", null, null,
  )
  // Closed session
  insert.run(
    "sess-closed", "hash3", 0, 1000, "closed-bearer-token",
    "2026-03-01 10:00:00", "2999-03-02 10:00:00", "2026-03-01 12:00:00", null,
  )
}

beforeEach(() => {
  db = createTestDb()
  seedSessions(db)
})

describe("getActiveSessions", () => {
  it("returns only active sessions", () => {
    const result = getActiveSessions(db)
    expect(result).toHaveLength(1)
    expect(result[0].session_id).toBe("sess-active")
  })

  it("never returns credential columns", () => {
    const result = getActiveSessions(db)
    for (const row of result) {
      expect(row).not.toHaveProperty("bearer_token")
      expect(row).not.toHaveProperty("refund_preimage")
      expect(row).not.toHaveProperty("return_invoice")
    }
  })

  it("returns the expected fields", () => {
    const result = getActiveSessions(db)
    expect(result[0]).toHaveProperty("session_id")
    expect(result[0]).toHaveProperty("payment_hash")
    expect(result[0]).toHaveProperty("balance_sats")
    expect(result[0]).toHaveProperty("deposit_sats")
    expect(result[0]).toHaveProperty("created_at")
    expect(result[0]).toHaveProperty("expires_at")
  })
})
