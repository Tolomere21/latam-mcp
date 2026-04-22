# @latam-mcp/mcp

MCP server for Peruvian public-data lookups — SUNAT RUC, BCRP exchange rates, and SEACE tenders. Built for Claude Desktop, Cursor, and any MCP client.

Backed by [`api.latam-mcp.com`](https://latam-mcp.com), which serves data sourced directly from SUNAT's officially-published Padrón Reducido open-data release and BCRP's open JSON API. No scraping, no captcha bypass, no third-party vendors.

## Install

```bash
npx -y @latam-mcp/mcp
```

## Claude Desktop config

```json
{
  "mcpServers": {
    "latam-mcp": {
      "command": "npx",
      "args": ["-y", "@latam-mcp/mcp"],
      "env": {
        "LATAM_MCP_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

Get a free API key (1,000 calls/mo, no card required) at [latam-mcp.com](https://latam-mcp.com).

## Tools exposed

| Tool | Description |
|---|---|
| `pe_ruc_lookup` | Look up a Peruvian SUNAT RUC (tax ID). Returns razón social, estado, condición, domicilio. |
| `pe_fx_rates` | BCRP exchange rates (USD/PEN, EUR/PEN buy & sell). Historical and current. |
| `pe_fx_indicators` | SBS interest-rate indicators (TEA, TIPMN, TAMN). |
| `pe_seace_search` | Peruvian government procurement (SEACE) search. |

## Environment variables

- `LATAM_MCP_API_KEY` (required) — your API key from [latam-mcp.com](https://latam-mcp.com)
- `LATAM_MCP_API_BASE` (optional) — override the API base URL (defaults to `https://api.latam-mcp.com`)

## Pricing

| Plan | Calls/mo | Rate limit | Price |
|---|---|---|---|
| Free | 1,000 | 10 rps | $0 |
| Indie | 25,000 | 50 rps | $19/mo |
| Scale | 250,000 | 200 rps | $99/mo |

Full pricing JSON at [latam-mcp.com/pricing.json](https://latam-mcp.com/pricing.json).

## Compliance

Data is sourced from Peru's officially-published open-data releases (SUNAT Padrón Reducido, BCRP). No DNI or personal-identity data is processed. Natural-person RUCs (prefix `10`) have `razon_social` masked. See [latam-mcp.com/compliance](https://latam-mcp.com/compliance.html) for the full legal statement.

## License

MIT
