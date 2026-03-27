/**
 * booth-sessions and booth-credits tools — conditional on ALLOW_DETAIL_TOOLS.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type Database from "better-sqlite3"
import { z } from "zod"
import { getActiveSessions, getCredits } from "../queries/sessions.js"
import { sanitise, type SanitiseOptions } from "../sanitise.js"

export function registerSessionsTool(
  server: McpServer,
  db: Database.Database,
  sanitiseOpts: SanitiseOptions,
): void {
  server.tool(
    "booth-sessions",
    "Active IETF Payment sessions (not closed, not expired)",
    {},
    async () => {
      const data = getActiveSessions(db)
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

export function registerCreditsTool(
  server: McpServer,
  db: Database.Database,
  sanitiseOpts: SanitiseOptions,
): void {
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
