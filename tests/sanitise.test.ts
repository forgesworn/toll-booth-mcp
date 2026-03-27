import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import { sanitise } from "../src/sanitise.js"

function expectedHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

describe("sanitise", () => {
  describe("REDACT_PII=true", () => {
    const opts = { redactPii: true }

    it("hashes payment_hash values", () => {
      const data = { payment_hash: "abc123def456" }
      sanitise(data, opts)
      expect(data.payment_hash).toBe(expectedHash("abc123def456"))
      expect(data.payment_hash).not.toBe("abc123def456")
      expect(data.payment_hash).toHaveLength(16)
    })

    it("strips session_id values", () => {
      const data = { session_id: "sess-12345" }
      sanitise(data, opts)
      expect(data.session_id).toBe("[redacted]")
    })

    it("strips bearer_token values", () => {
      const data = { bearer_token: "token-xyz" }
      sanitise(data, opts)
      expect(data.bearer_token).toBe("[redacted]")
    })

    it("strips macaroon values", () => {
      const data = { macaroon: "mac-data" }
      sanitise(data, opts)
      expect(data.macaroon).toBe("[redacted]")
    })

    it("strips settlement_secret values", () => {
      const data = { settlement_secret: "secret-data" }
      sanitise(data, opts)
      expect(data.settlement_secret).toBe("[redacted]")
    })

    it("strips client_ip values", () => {
      const data = { client_ip: "192.168.1.1" }
      sanitise(data, opts)
      expect(data.client_ip).toBe("[redacted]")
    })

    it("strips bolt11 values", () => {
      const data = { bolt11: "lnbc100n1..." }
      sanitise(data, opts)
      expect(data.bolt11).toBe("[redacted]")
    })

    it("strips return_invoice values", () => {
      const data = { return_invoice: "lnbc200n1..." }
      sanitise(data, opts)
      expect(data.return_invoice).toBe("[redacted]")
    })

    it("strips status_token values", () => {
      const data = { status_token: "tok-abc" }
      sanitise(data, opts)
      expect(data.status_token).toBe("[redacted]")
    })

    it("strips token values", () => {
      const data = { token: "claim-tok" }
      sanitise(data, opts)
      expect(data.token).toBe("[redacted]")
    })

    it("strips refund_preimage values", () => {
      const data = { refund_preimage: "preimage-data" }
      sanitise(data, opts)
      expect(data.refund_preimage).toBe("[redacted]")
    })

    it("rounds timestamps to hour granularity", () => {
      const data = { created_at: "2026-03-15T14:35:22.000Z" }
      sanitise(data, opts)
      expect(data.created_at).toBe("2026-03-15T14:00:00Z")
    })

    it("rounds all timestamp fields", () => {
      const data = {
        created_at: "2026-03-15T14:35:22.000Z",
        updated_at: "2026-03-15T15:45:00.000Z",
        settled_at: "2026-03-15T16:10:30.000Z",
        claimed_at: "2026-03-15T17:55:00.000Z",
        expires_at: "2026-03-16T00:00:00.000Z",
        closed_at: "2026-03-15T23:59:59.000Z",
      }
      sanitise(data, opts)
      expect(data.created_at).toBe("2026-03-15T14:00:00Z")
      expect(data.updated_at).toBe("2026-03-15T15:00:00Z")
      expect(data.settled_at).toBe("2026-03-15T16:00:00Z")
      expect(data.claimed_at).toBe("2026-03-15T17:00:00Z")
      expect(data.expires_at).toBe("2026-03-16T00:00:00Z")
      expect(data.closed_at).toBe("2026-03-15T23:00:00Z")
    })

    it("handles arrays of objects", () => {
      const data = [
        { payment_hash: "hash1", client_ip: "1.2.3.4" },
        { payment_hash: "hash2", client_ip: "5.6.7.8" },
      ]
      sanitise(data, opts)
      expect(data[0].payment_hash).toBe(expectedHash("hash1"))
      expect(data[0].client_ip).toBe("[redacted]")
      expect(data[1].payment_hash).toBe(expectedHash("hash2"))
      expect(data[1].client_ip).toBe("[redacted]")
    })

    it("recurses into nested objects", () => {
      const data = {
        summary: {
          days: [{ payment_hash: "nested-hash", created_at: "2026-01-01T12:30:00.000Z" }],
        },
      }
      sanitise(data, opts)
      expect(data.summary.days[0].payment_hash).toBe(expectedHash("nested-hash"))
      expect(data.summary.days[0].created_at).toBe("2026-01-01T12:00:00Z")
    })

    it("handles null and undefined gracefully", () => {
      expect(sanitise(null, opts)).toBeNull()
      expect(sanitise(undefined, opts)).toBeUndefined()
    })

    it("handles non-ISO timestamp strings gracefully", () => {
      const data = { created_at: "not-a-date" }
      sanitise(data, opts)
      expect(data.created_at).toBe("not-a-date")
    })
  })

  describe("REDACT_PII=false", () => {
    const opts = { redactPii: false }

    it("truncates payment_hash to 16 characters", () => {
      const data = { payment_hash: "abcdef1234567890abcdef1234567890" }
      sanitise(data, opts)
      expect(data.payment_hash).toBe("abcdef1234567890")
    })

    it("leaves session_id intact", () => {
      const data = { session_id: "sess-12345" }
      sanitise(data, opts)
      expect(data.session_id).toBe("sess-12345")
    })

    it("leaves timestamps intact", () => {
      const data = { created_at: "2026-03-15T14:35:22.000Z" }
      sanitise(data, opts)
      expect(data.created_at).toBe("2026-03-15T14:35:22.000Z")
    })
  })
})
