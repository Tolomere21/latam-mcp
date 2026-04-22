# LATAM-MCP

Developer API and MCP server for Peruvian public-data lookups — SUNAT RUC, BCRP exchange rates, SEACE tenders. Built for Claude, Cursor, and any MCP client.

Sourced directly from Peru's officially-published open-data releases (SUNAT Padrón Reducido, BCRP open JSON API). No scraping, no captcha bypass, no third-party vendors. See [latam-mcp.com/compliance](https://latam-mcp.com/compliance.html) for the full legal statement.

## Install (MCP client)

```bash
npx -y @latam-mcp/mcp
```

Claude Desktop config:

```json
{
  "mcpServers": {
    "latam-mcp": {
      "command": "npx",
      "args": ["-y", "@latam-mcp/mcp"],
      "env": { "LATAM_MCP_API_KEY": "YOUR_KEY" }
    }
  }
}
```

Get a free API key at [latam-mcp.com](https://latam-mcp.com) (1,000 calls/month, no card required).

## HTTP API

```bash
curl https://api.latam-mcp.com/pe/ruc/20100017491 \
  -H "authorization: Bearer $KEY"
```

See [latam-mcp.com/llms.txt](https://latam-mcp.com/llms.txt) for the full endpoint reference, or [latam-mcp.com/openapi.json](https://latam-mcp.com/openapi.json) for the OpenAPI 3.1 spec.

## Monorepo layout

| Path | Purpose |
|---|---|
| `apps/api/` | Hono REST API with auth, rate limiting, caching |
| `apps/ingest/` | Daily padrón downloader + SQLite loader |
| `apps/mcp/` | MCP server exposing the REST API as tools |
| `apps/landing/` | Static marketing site (Cloudflare Pages) |
| `packages/schemas/` | Shared Zod schemas |
| `infra/` | Fly.io Dockerfile + fly.toml |

## License

MIT
