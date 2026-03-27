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

  /** When true, payment hashes are one-way hashed and session IDs are stripped. */
  redactPii: boolean

  /** When true, detail tools (recent-payments, credits, sessions) are registered. */
  allowDetailTools: boolean
}

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

  if (!redactPii) {
    process.stderr.write(
      "[toll-booth-mcp] WARNING: REDACT_PII=false — full identifiers will be exposed to the AI platform.\n",
    )
  }

  return {
    dbPath: process.env.TOLL_BOOTH_DB ?? "./toll-booth.db",
    transport,
    port,
    bindAddress: process.env.BIND_ADDRESS ?? "127.0.0.1",
    redactPii,
    allowDetailTools,
  }
}
