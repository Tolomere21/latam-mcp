import type { TenderSearchResponse, Tender } from "@latam-mcp/schemas";
import { UpstreamError } from "./http.js";

type Raw = Omit<TenderSearchResponse, "fetched_at" | "stale">;

export async function fetchSeaceTenders(params: {
  query?: string;
  region?: string;
  since?: string;
  limit: number;
}): Promise<Raw> {
  const mode = process.env.SEACE_UPSTREAM ?? "stub";

  if (mode === "stub") {
    const base: Tender[] = [
      {
        id: "SEACE-2026-000123",
        title: "Adquisición de computadoras portátiles para ministerio",
        entity: "Ministerio de Educación",
        region: "Lima",
        published_at: new Date(Date.now() - 86400000).toISOString(),
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        amount_pen: 480000,
        url: "https://prodapp2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/buscadorPublico.xhtml",
      },
      {
        id: "SEACE-2026-000124",
        title: "Servicios de mantenimiento de carreteras en Cusco",
        entity: "MTC - Provías Nacional",
        region: "Cusco",
        published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        amount_pen: 2100000,
        url: "https://prodapp2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/buscadorPublico.xhtml",
      },
    ];
    const filtered = base.filter((t) => {
      if (params.query && !t.title.toLowerCase().includes(params.query.toLowerCase())) return false;
      if (params.region && t.region?.toLowerCase() !== params.region.toLowerCase()) return false;
      if (params.since && t.published_at < params.since) return false;
      return true;
    });
    return { results: filtered.slice(0, params.limit) };
  }

  throw new UpstreamError(`SEACE upstream mode '${mode}' not implemented`, 501);
}
