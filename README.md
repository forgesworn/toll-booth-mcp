# forgesworn/toll-booth-mcp

[![GitHub Sponsors](https://img.shields.io/github/sponsors/TheCryptoDonkey?logo=githubsponsors&color=ea4aaa&label=Sponsor)](https://github.com/sponsors/TheCryptoDonkey)

*Admin MCP server for monitoring [toll-booth](https://github.com/forgesworn/toll-booth) deployments. Read-only analytics with interactive widgets for a Lightning payment gateway.*

## What it does

Attaches to a toll-booth SQLite database in read-only mode and exposes
analytics as MCP tools. Pair it with an MCP client (Claude Desktop,
Cursor, Zed, etc.) and get live visibility into:

- **Payment history**: sats received over time as a chart with summary statistics
- **Services**: active gated endpoints grouped by pricing tier with payment statistics
- **Revenue**: aggregate revenue statistics across all toll-booth payments
- **Sessions and credits**: active payment sessions and credit balances (opt-in detail tools)

Three of the tools register interactive UI widgets via the MCP
ext-apps bundle. Clients that support widgets render them inline;
other clients fall back to the JSON response.

## Install

From source (while unpublished):

```sh
git clone https://github.com/forgesworn/toll-booth-mcp.git
cd toll-booth-mcp
npm install
npm run build
```

Requires Node >= 20.

## Configuration

All configuration via environment variables:

| Variable | Default | Description |
|---|---|---|
| `TOLL_BOOTH_DB` | `./toll-booth.db` | Path to the toll-booth SQLite database |
| `TRANSPORT` | `stdio` | `stdio` or `http` |
| `PORT` | `3500` | HTTP listen port (HTTP transport only) |
| `BIND_ADDRESS` | `127.0.0.1` | HTTP bind address (HTTP transport only) |
| `REDACT_PII` | `true` | Hash payment hashes and strip session IDs before returning data to the client |
| `ALLOW_DETAIL_TOOLS` | `false` | Register `booth-recent-payments`, `booth-credits`, `booth-sessions` (return PII-adjacent rows) |

Setting `REDACT_PII=false` emits a stderr warning — full identifiers
are then exposed to whichever AI platform drives the MCP client.

## MCP client setup

### Claude Desktop / Cursor / stdio

```json
{
  "mcpServers": {
    "toll-booth": {
      "command": "node",
      "args": ["/absolute/path/to/toll-booth-mcp/dist/src/index.js"],
      "env": {
        "TOLL_BOOTH_DB": "/absolute/path/to/toll-booth.db"
      }
    }
  }
}
```

### HTTP transport (remote deployments)

```sh
TRANSPORT=http TOLL_BOOTH_DB=/path/to/db npm start
```

On startup the server prints a bearer token to stderr. Send it as the
`Authorization: Bearer <token>` header from your MCP client. The HTTP
server rate-limits at 60 requests per minute per IP and validates the
bearer with constant-time comparison.

## Tools

| Tool | Returns |
|---|---|
| `booth-status` | Database connection state |
| `booth-payment-history` | Sats received over a window (default 30 days), chart + summary |
| `booth-services` | Active gated endpoints grouped by tier with payment statistics |
| `booth-revenue` | Aggregate revenue statistics |
| `booth-recent-payments` | Recent settled payments (detail, opt-in) |
| `booth-credits` | Active credit balances above a threshold (detail, opt-in) |
| `booth-sessions` | Open IETF Payment sessions (detail, opt-in) |

Detail tools are gated behind `ALLOW_DETAIL_TOOLS=true` because they
return per-row data with PII adjacency even after redaction.

## Read-only by design

The MCP server opens the database with `{ readonly: true,
fileMustExist: true }` via `better-sqlite3`. No write tools are
registered. Compromise of the MCP client cannot alter toll-booth
state — the worst it can do is read data the server is configured to
expose.

## Develop

```sh
npm install
npm run build   # compile server + bundle widgets
npm test        # vitest
```

Widgets are built from `widgets/` into inline HTML bundles during
`npm run build`. The server loads them at runtime and serves them as
MCP resources.

## Licence

MIT. See [LICENCE](LICENCE).
