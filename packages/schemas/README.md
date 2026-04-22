# @latam-mcp/schemas

Shared Zod schemas and TypeScript types for [LATAM-MCP](https://latam-mcp.com) — the Peruvian public-data API for AI agents.

## Install

```bash
npm install @latam-mcp/schemas
```

## Usage

```ts
import { RucResponse, FxRatesResponse, ErrorEnvelope } from "@latam-mcp/schemas";

// Parse a response from the LATAM-MCP API
const data = RucResponse.parse(await response.json());
```

## Schemas exported

- `RucParam`, `RucResponse`
- `FxRatesQuery`, `FxRatesResponse`
- `FxIndicatorType`, `FxIndicatorsQuery`, `FxIndicatorsResponse`
- `TenderSearchQuery`, `TenderSearchResponse`, `Tender`
- `ErrorEnvelope`

## License

MIT
