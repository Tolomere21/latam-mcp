#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { RucParam, FxIndicatorType } from "@latam-mcp/schemas";

const API_BASE = process.env.LATAM_MCP_API_BASE ?? "https://api.latam-mcp.com";
const API_KEY = process.env.LATAM_MCP_API_KEY ?? "";

async function callApi(path: string): Promise<unknown> {
  if (!API_KEY) throw new Error("LATAM_MCP_API_KEY not set");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${API_KEY}`, accept: "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Upstream ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

const server = new Server(
  { name: "latam-mcp", version: "0.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "pe_ruc_lookup",
      description:
        "Look up a Peruvian SUNAT RUC (tax ID). Returns razón social, estado, condición, domicilio, actividad económica. Natural-person RUCs (prefix 10) have masked names for data-protection compliance.",
      inputSchema: {
        type: "object",
        properties: { ruc: { type: "string", description: "11-digit Peruvian RUC" } },
        required: ["ruc"],
      },
    },
    {
      name: "pe_fx_rates",
      description:
        "Peruvian SBS exchange rates (USD/PEN, EUR/PEN buy & sell). Returns most recent rate if no date is given.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD (optional; defaults to today)" },
        },
      },
    },
    {
      name: "pe_fx_indicators",
      description:
        "Peruvian SBS interest-rate indicator. Types: tea (effective annual rate), tipmn (passive in soles), tamn (active in soles).",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["tea", "tipmn", "tamn"] },
          date: { type: "string", description: "YYYY-MM-DD (optional)" },
        },
        required: ["type"],
      },
    },
    {
      name: "pe_seace_search",
      description:
        "Search the Peruvian government procurement portal (SEACE). Returns tenders matching the query, region, and optional since-date filter.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search (Spanish)" },
          region: { type: "string", description: "Department/region filter (e.g. Lima)" },
          since: { type: "string", description: "YYYY-MM-DD — only tenders published on or after" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  try {
    if (name === "pe_ruc_lookup") {
      const ruc = RucParam.parse(args.ruc);
      const data = await callApi(`/pe/ruc/${ruc}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    if (name === "pe_fx_rates") {
      const date = typeof args.date === "string" ? args.date : undefined;
      const data = await callApi(`/pe/fx/rates${qs({ date })}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    if (name === "pe_fx_indicators") {
      const type = FxIndicatorType.parse(args.type);
      const date = typeof args.date === "string" ? args.date : undefined;
      const data = await callApi(`/pe/fx/indicators${qs({ type, date })}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    if (name === "pe_seace_search") {
      const data = await callApi(
        `/pe/seace/tenders${qs({
          query: typeof args.query === "string" ? args.query : undefined,
          region: typeof args.region === "string" ? args.region : undefined,
          since: typeof args.since === "string" ? args.since : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
        })}`,
      );
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
