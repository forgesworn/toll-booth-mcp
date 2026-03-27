#!/usr/bin/env node
/**
 * toll-booth-mcp — Admin MCP server for monitoring toll-booth deployments.
 *
 * Connects to a toll-booth SQLite database in read-only mode and exposes
 * analytics tools with optional interactive widget UIs.
 */

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server"
import type Database from "better-sqlite3"
import { z } from "zod"
import { loadConfig } from "./config.js"
import { openReadOnly } from "./db.js"
import type { SanitiseOptions } from "./sanitise.js"
import { sanitise } from "./sanitise.js"
import { getPaymentHistory, getRecentPayments } from "./queries/payments.js"
import { getServiceTiers } from "./queries/services.js"
import { getRevenueStats } from "./queries/revenue.js"
import { getActiveSessions, getCredits } from "./queries/sessions.js"
import { registerStatusTool } from "./tools/status.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = loadConfig()
const db = openReadOnly(config.dbPath)

const sanitiseOpts: SanitiseOptions = { redactPii: config.redactPii }

const server = new McpServer(
  { name: "toll-booth-mcp", version: "0.1.0" },
  {
    instructions:
      "Read-only analytics for a toll-booth Lightning payment gateway. " +
      "Use booth-status to verify the database connection. " +
      "Use booth-payment-history, booth-services, and booth-revenue for aggregate views. " +
      "Detail tools (booth-recent-payments, booth-credits, booth-sessions) are only available when ALLOW_DETAIL_TOOLS=true.",
  },
)

// --- Load ext-apps browser bundle for widget injection ---

const require = createRequire(import.meta.url)
let extAppsBundle: string
try {
  extAppsBundle = readFileSync(
    require.resolve("@modelcontextprotocol/ext-apps/app-with-deps"),
    "utf8",
  ).replace(/export\{([^}]+)\};?\s*$/, (_, body: string) =>
    "globalThis.ExtApps={" +
    body
      .split(",")
      .map((p: string) => {
        const [local, exported] = p.split(" as ").map((s: string) => s.trim())
        return `${exported ?? local}:${local}`
      })
      .join(",") +
    "};",
  )
} catch (err) {
  process.stderr.write(
    `[toll-booth-mcp] WARNING: Could not load ext-apps bundle: ${err instanceof Error ? err.message : String(err)}\n`,
  )
  extAppsBundle = ""
}

// --- Load widget HTML templates ---

function loadWidgetHtml(name: string): string | null {
  try {
    const htmlPath = join(__dirname, "..", "widgets", name, "index.html")
    const raw = readFileSync(htmlPath, "utf8")
    return raw.replace("/*__EXT_APPS_BUNDLE__*/", () => extAppsBundle)
  } catch {
    return null
  }
}

const widgetHtmlMap: Record<string, string | null> = {
  "payment-history": loadWidgetHtml("payment-history"),
  "services-table": loadWidgetHtml("services-table"),
  "revenue-dashboard": loadWidgetHtml("revenue-dashboard"),
}

// --- Widget registration helper ---

function registerWidgetResource(toolName: string, widgetKey: string): void {
  const html = widgetHtmlMap[widgetKey]
  if (!html) return

  const resourceUri = `ui://toll-booth/${widgetKey}.html`

  registerAppResource(
    server,
    `Toll Booth ${widgetKey}`,
    resourceUri,
    { description: `Interactive widget for ${toolName}` },
    async () => ({
      contents: [
        {
          uri: resourceUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
        },
      ],
    }),
  )
}

// --- Register always-on tool ---

registerStatusTool(server, db)

// --- Register widget tools ---

// booth-payment-history
const paymentHistoryWidget = widgetHtmlMap["payment-history"]
if (paymentHistoryWidget) {
  registerWidgetResource("booth-payment-history", "payment-history")
}

registerAppTool(
  server,
  "booth-payment-history",
  {
    description: "Sats received over time as a chart with summary statistics",
    inputSchema: {
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe("Number of days to look back (default 30)"),
    },
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: "ui://toll-booth/payment-history.html" } },
  },
  async ({ days }) => {
    const data = getPaymentHistory(db, days ?? 30)
    sanitise(data, sanitiseOpts)
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    }
  },
)

// booth-services
if (widgetHtmlMap["services-table"]) {
  registerWidgetResource("booth-services", "services-table")
}

registerAppTool(
  server,
  "booth-services",
  {
    description: "Active gated endpoints grouped by pricing tier with payment statistics",
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: "ui://toll-booth/services-table.html" } },
  },
  async () => {
    const data = getServiceTiers(db)
    sanitise(data, sanitiseOpts)
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    }
  },
)

// booth-revenue
if (widgetHtmlMap["revenue-dashboard"]) {
  registerWidgetResource("booth-revenue", "revenue-dashboard")
}

registerAppTool(
  server,
  "booth-revenue",
  {
    description: "Aggregate revenue statistics across all toll-booth payments",
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: "ui://toll-booth/revenue-dashboard.html" } },
  },
  async () => {
    const data = getRevenueStats(db)
    sanitise(data, sanitiseOpts)
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    }
  },
)

// --- Conditional detail tools ---

if (config.allowDetailTools) {
  server.tool(
    "booth-recent-payments",
    "List the most recent settled payments",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of results (default 20)"),
    },
    async ({ limit }) => {
      const data = getRecentPayments(db, limit ?? 20)
      sanitise(data, sanitiseOpts)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      }
    },
  )

  server.tool(
    "booth-credits",
    "Active credit balances above a minimum threshold",
    {
      minBalanceSats: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Minimum sats balance to include (default 0)"),
    },
    async ({ minBalanceSats }) => {
      const data = getCredits(db, minBalanceSats ?? 0)
      sanitise(data, sanitiseOpts)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      }
    },
  )

  server.tool(
    "booth-sessions",
    "Active IETF Payment sessions (not closed, not expired)",
    {},
    async () => {
      const data = getActiveSessions(db)
      sanitise(data, sanitiseOpts)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      }
    },
  )
}

// --- Transport ---

const toolCount = 4 + (config.allowDetailTools ? 3 : 0)
process.stderr.write(`[toll-booth-mcp] ${toolCount} tools registered (detail tools: ${config.allowDetailTools})\n`)

if (config.transport === "stdio") {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  await server.connect(new StdioServerTransport())
  process.stderr.write("[toll-booth-mcp] started (stdio)\n")
} else {
  const { createServer } = await import("node:http")
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  )
  const { randomUUID, timingSafeEqual } = await import("node:crypto")

  const token = randomUUID()
  process.stderr.write(`[toll-booth-mcp] HTTP auth token: ${token}\n`)

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)

  const expectedAuth = Buffer.from(`Bearer ${token}`)

  // Sliding window rate limiter (per-IP)
  const rateLimits = new Map<string, { count: number; resetAt: number }>()
  const RATE_WINDOW = 60_000
  const RATE_LIMIT = 60

  function checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const entry = rateLimits.get(ip)
    if (!entry || now > entry.resetAt) {
      rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
      return true
    }
    entry.count++
    return entry.count <= RATE_LIMIT
  }

  const httpServer = createServer(async (req, res) => {
    const clientIp = req.socket.remoteAddress ?? "unknown"

    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "60" })
      res.end(JSON.stringify({ error: "Too many requests" }))
      return
    }

    const actual = Buffer.from(req.headers.authorization ?? "")
    if (actual.length !== expectedAuth.length || !timingSafeEqual(actual, expectedAuth)) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorised" }))
      return
    }

    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ status: "ok" }))
      return
    }

    if (req.method === "POST") {
      const MAX_BODY = 1_048_576
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += (chunk as Buffer).length
        if (size > MAX_BODY) {
          res.writeHead(413, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: "Request body too large" }))
          return
        }
        chunks.push(chunk as Buffer)
      }
      let body: unknown
      try {
        body = JSON.parse(Buffer.concat(chunks).toString())
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Invalid JSON" }))
        return
      }
      await transport.handleRequest(req, res, body)
    } else {
      await transport.handleRequest(req, res)
    }
  })

  httpServer.listen(config.port, config.bindAddress, () => {
    process.stderr.write(`[toll-booth-mcp] HTTP on ${config.bindAddress}:${config.port}\n`)
  })
}

// Graceful shutdown
const shutdown = () => {
  db.close()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
