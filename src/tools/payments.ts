/**
 * booth-payment-history and booth-recent-payments tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { z } from "zod"
import { getPaymentHistory, getRecentPayments } from "../queries/payments.js"
import { sanitise, type SanitiseOptions } from "../sanitise.js"

export function registerPaymentHistoryTool(
  server: McpServer,
  db: Database.Database,
  sanitiseOpts: SanitiseOptions,
  registerWidget: (toolName: string, widgetFile: string) => void,
): void {
  registerWidget("booth-payment-history", "payment-history")

  server.tool(
    "booth-payment-history",
    "Sats received over time as a chart with summary statistics",
    { days: z.number().int().min(1).max(365).optional().describe("Number of days to look back (default 30)") },
    async ({ days }) => {
      const data = getPaymentHistory(db, days ?? 30)
      sanitise(data, sanitiseOpts)

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      }
    },
  )
}

export function registerRecentPaymentsTool(
  server: McpServer,
  db: Database.Database,
  sanitiseOpts: SanitiseOptions,
): void {
  server.tool(
    "booth-recent-payments",
    "List the most recent settled payments",
    { limit: z.number().int().min(1).max(100).optional().describe("Maximum number of results (default 20)") },
    async ({ limit }) => {
      const data = getRecentPayments(db, limit ?? 20)
      sanitise(data, sanitiseOpts)

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      }
    },
  )
}
