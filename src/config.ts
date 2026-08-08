/**
 * Configuration parsed from environment variables.
 *
 * All values have sensible defaults suitable for local development.
 */

export interface Config {
  /** Absolute or relative path to the toll-booth SQLite database. */
  dbPath: string

  /** Transport mode: stdio (default) or http. */
  transport: "stdio" | "http"

  /** HTTP listen port (only used when transport is "http"). */
  port: number

  /** HTTP bind address (only used when transport is "http"). */
  bindAddress: string

  /** When true, PII identifiers are hashed, stripped or coarsened (credentials are always redacted). */
  redactPii: boolean

  /** When true, detail tools (recent-payments, credits, sessions) are registered. */
  allowDetailTools: boolean

  /** When true, permit the HTTP transport to bind non-loopback addresses without TLS. */
  allowInsecureRemote: boolean
}

/** Loopback bind addresses considered safe for the plaintext HTTP transport. */
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "localhost"])

export function loadConfig(): Config {
  const transport = (process.env.TRANSPORT ?? "stdio").toLowerCase()
  if (transport !== "stdio" && transport !== "http") {
    throw new Error(`Invalid TRANSPORT value: "${transport}" (expected "stdio" or "http")`)
  }

  const port = Number(process.env.PORT ?? "3500")
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: "${process.env.PORT}"`)
  }

  const redactPii = (process.env.REDACT_PII ?? "true").toLowerCase() !== "false"
  const allowDetailTools = (process.env.ALLOW_DETAIL_TOOLS ?? "false").toLowerCase() === "true"
  const allowInsecureRemote = (process.env.ALLOW_INSECURE_REMOTE ?? "false").toLowerCase() === "true"

  if (!redactPii) {
    process.stderr.write(
      "[toll-booth-mcp] WARNING: REDACT_PII=false — full identifiers will be exposed to the AI platform.\n",
    )
  }

  const bindAddress = process.env.BIND_ADDRESS ?? "127.0.0.1"

  // The HTTP transport is plaintext: the per-boot bearer token travels in
  // the clear. Refuse non-loopback binds unless explicitly overridden, and
  // even then warn loudly — remote deployments should sit behind a
  // TLS-terminating reverse proxy bound to loopback.
  if (transport === "http" && !LOOPBACK_ADDRESSES.has(bindAddress)) {
    if (!allowInsecureRemote) {
      throw new Error(
        `Refusing to start: TRANSPORT=http with BIND_ADDRESS="${bindAddress}" would expose the ` +
          "plaintext bearer token on the network. Bind a loopback address behind a TLS-terminating " +
          "reverse proxy, or set ALLOW_INSECURE_REMOTE=true to override.",
      )
    }
    process.stderr.write(
      `[toll-booth-mcp] WARNING: ALLOW_INSECURE_REMOTE=true — serving plaintext HTTP on ${bindAddress}. ` +
        "The bearer token and all traffic are exposed to network eavesdroppers.\n",
    )
  }

  return {
    dbPath: process.env.TOLL_BOOTH_DB ?? "./toll-booth.db",
    transport,
    port,
    bindAddress,
    redactPii,
    allowDetailTools,
    allowInsecureRemote,
  }
}
