# toll-booth-mcp

Admin MCP server for monitoring [toll-booth](https://github.com/forgesworn/toll-booth)
deployments. Attaches to a toll-booth SQLite database in read-only mode and
exposes payment, service and revenue analytics as MCP tools, three of them
with interactive UI widgets via the MCP ext-apps bundle. No write tools are
registered.

## Build & Test

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run build` | Compile the server and bundle the widgets |
| `npm run build:server` | Compile the server only |
| `npm run build:widgets` | Bundle the widgets only |
| `npm test` | Run the vitest suite |
| `npm run typecheck` | Type-check without emitting |
| `npm start` | Run the built server (stdio transport) |
| `npm run start:http` | Run the built server (HTTP transport) |

## Structure

```
src/
  index.ts       entry point: registers tools, widgets and transport
  config.ts      environment variable loading
  db.ts          read-only better-sqlite3 connection
  sanitise.ts    PII redaction for tool responses
  queries/       SQL queries against the toll-booth database
  tools/         MCP tool registration helpers
widgets/         source for the interactive widget bundles
tests/           vitest suite, mirrors src/ layout
scripts/         build-widgets.mjs bundles widgets/ into dist/widgets
```

## Conventions

- British English in prose and comments.
- Amounts are in sats (smallest Lightning unit), not fractional BTC.
- Read-only by design: the database opens with `{ readonly: true, fileMustExist: true }`; do not add write tools.
- PII (payment hashes, session IDs) is redacted by default via `sanitise.ts`; detail tools are gated behind `ALLOW_DETAIL_TOOLS`.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Tool registration, widget wiring, stdio/HTTP transport |
| `src/config.ts` | Reads `TOLL_BOOTH_DB`, `TRANSPORT`, `PORT`, `BIND_ADDRESS`, `REDACT_PII`, `ALLOW_DETAIL_TOOLS`, `ALLOW_INSECURE_REMOTE` |
| `src/sanitise.ts` | Strips or hashes PII-adjacent fields before a tool response is returned |
| `scripts/build-widgets.mjs` | Bundles `widgets/` into inline HTML served as MCP resources |

## Common Pitfalls

- The HTTP transport is plaintext; it refuses to bind a non-loopback address unless `ALLOW_INSECURE_REMOTE=true`. Front it with a TLS-terminating reverse proxy for remote use.
- `REDACT_PII=false` exposes full identifiers to the MCP client; it also emits a stderr warning.
- Detail tools (`booth-recent-payments`, `booth-credits`, `booth-sessions`) only register when `ALLOW_DETAIL_TOOLS=true`.
- Widgets must be rebuilt (`npm run build:widgets`) after editing anything under `widgets/`; the server loads compiled HTML from `dist/widgets`, not the source.
