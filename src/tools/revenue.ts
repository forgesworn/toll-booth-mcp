/**
 * booth-revenue tool — aggregate revenue statistics.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { getRevenueStats } from "../queries/revenue.js"
import { sanitise, type SanitiseOptions } from "../sanitise.js"

export function registerRevenueTool(
  server: McpServer,
  db: Database.Database,
  sanitiseOpts: SanitiseOptions,
  registerWidget: (toolName: string, widgetFile: string) => void,
): void {
  registerWidget("booth-revenue", "revenue-dashboard")

  server.tool(
    "booth-revenue",
    "Aggregate revenue statistics across all toll-booth payments",
    {},
    async () => {
      const data = getRevenueStats(db)
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
