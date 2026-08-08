/**
 * Sanitisation pipeline.
 *
 * Credential-class fields (bearer tokens, macaroons, invoices, secrets)
 * are always redacted — they authorise payment actions at the gateway and
 * must never reach the MCP client's context window, regardless of config.
 *
 * When REDACT_PII=true (default), PII-class identifiers (payment hashes,
 * session IDs, IP addresses, timestamps) are additionally hashed or
 * stripped so they cannot be recovered from AI platform logs.
 */

import { createHash } from "node:crypto"
import type { Config } from "./config.js"

/** One-way SHA-256 hash, truncated to 16 hex characters. */
function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

/** Round an ISO timestamp to the nearest hour. */
function roundToHour(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  d.setMinutes(0, 0, 0)
  return d.toISOString().replace(/\.\d{3}Z$/, "Z")
}

/** Truncate a hex string to 16 characters for display. */
function truncateHash(value: string): string {
  return value.slice(0, 16)
}

export interface SanitiseOptions {
  redactPii: boolean
}

/** Field names that carry credentials usable at the gateway. Always redacted. */
const CREDENTIAL_FIELDS = new Set([
  "bearer_token",
  "macaroon",
  "settlement_secret",
  "refund_preimage",
  "status_token",
  "token",
  "bolt11",
  "return_invoice",
])

/**
 * Sanitise a response object in-place.
 *
 * Walks the object graph looking for known sensitive field names.
 * Credential-class fields are redacted unconditionally; PII-class fields
 * follow the configured redaction strategy.
 */
export function sanitise<T>(data: T, opts: SanitiseOptions): T {
  if (data === null || data === undefined || typeof data !== "object") {
    return data
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      data[i] = sanitise(data[i], opts)
    }
    return data
  }

  const record = data as Record<string, unknown>

  for (const key of Object.keys(record)) {
    const value = record[key]

    // Credentials are redacted regardless of REDACT_PII
    if (CREDENTIAL_FIELDS.has(key) && typeof value === "string") {
      record[key] = "[redacted]"
      continue
    }

    if (opts.redactPii) {
      // Hash payment hashes (one-way)
      if (key === "payment_hash" && typeof value === "string") {
        record[key] = hashIdentifier(value)
        continue
      }

      // Strip session IDs entirely
      if (key === "session_id" && typeof value === "string") {
        record[key] = "[redacted]"
        continue
      }

      // Strip IP addresses
      if (key === "client_ip" && typeof value === "string") {
        record[key] = "[redacted]"
        continue
      }

      // Round individual timestamps to hour granularity
      if (
        (key === "created_at" || key === "updated_at" || key === "settled_at" ||
         key === "claimed_at" || key === "expires_at" || key === "closed_at") &&
        typeof value === "string"
      ) {
        record[key] = roundToHour(value)
        continue
      }
    } else {
      // REDACT_PII=false: truncate payment hashes for readability
      if (key === "payment_hash" && typeof value === "string") {
        record[key] = truncateHash(value)
        continue
      }
    }

    // Recurse into nested objects
    if (typeof value === "object" && value !== null) {
      record[key] = sanitise(value, opts)
    }
  }

  return data
}
