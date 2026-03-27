/**
 * booth-status tool — DB health check and metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"

export function registerStatusTool(server: McpServer, db: Database.Database): void {
  server.tool(
    "booth-status",
    "Database health check and metadata for the toll-booth deployment",
    {},
    async () => {
      try {
        const counts = db
          .prepare(
            `SELECT
              (SELECT COUNT(*) FROM invoices) AS invoices,
              (SELECT COUNT(*) FROM settlements) AS settlements,
              (SELECT COUNT(*) FROM credits) AS credits,
              (SELECT COUNT(*) FROM sessions) AS sessions,
              (SELECT COUNT(*) FROM claims) AS claims`,
          )
          .get() as Record<string, number>

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "healthy",
                  tables: counts,
                },
                null,
                2,
              ),
            },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "error",
                message: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
          isError: true,
        }
      }
    },
  )
}
