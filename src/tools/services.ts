/**
 * booth-services tool — active gated endpoints with stats.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { getServiceTiers } from "../queries/services.js"
import { sanitise, type SanitiseOptions } from "../sanitise.js"

export function registerServicesTool(
  server: McpServer,
  db: Database.Database,
  sanitiseOpts: SanitiseOptions,
  registerWidget: (toolName: string, widgetFile: string) => void,
): void {
  registerWidget("booth-services", "services-table")

  server.tool(
    "booth-services",
    "Active gated endpoints grouped by pricing tier with payment statistics",
    {},
    async () => {
      const data = getServiceTiers(db)
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
