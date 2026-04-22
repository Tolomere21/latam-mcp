import type { RucResponse } from "@latam-mcp/schemas";
import { UpstreamError } from "./http.js";
import { getPadronDb, getPadronFreshness, hasPadronTable } from "../db.js";

type Raw = Omit<RucResponse, "fetched_at" | "stale">;

type Row = {
  ruc: string;
  razon_social: string;
  estado: string | null;
  condicion: string | null;
  tipo_contribuyente: string | null;
  domicilio: string | null;
  ubigeo: string | null;
  actividad_economica: string | null;
  fecha_inscripcion: string | null;
};

/**
 * Serve RUC lookups from our local copy of SUNAT's officially-published
 * Padrón Reducido del RUC (daily open-data release). No scraping, no captcha
 * bypass, no third-party vendor — just a query against the indexed DB.
 *
 * If the ingestion job hasn't run yet (empty/missing DB), we fail loud with
 * a 503 so the api doesn't silently serve stale/empty data.
 */
export function fetchRucFromPadron(ruc: string): Raw {
  const db = getPadronDb();

  if (!hasPadronTable(db)) {
    throw new UpstreamError(
      "Padrón DB not initialized — run `pnpm --filter @latam-mcp/ingest start` first.",
      503,
    );
  }

  const row = db
    .prepare(
      `SELECT ruc, razon_social, estado, condicion, tipo_contribuyente,
              domicilio, ubigeo, actividad_economica, fecha_inscripcion
       FROM ruc WHERE ruc = ?`,
    )
    .get(ruc) as Row | undefined;

  if (!row) {
    throw new UpstreamError(`RUC ${ruc} not found in padrón`, 404);
  }

  return {
    ruc: row.ruc,
    razon_social: row.razon_social,
    estado: row.estado ?? "",
    condicion: row.condicion ?? "",
    domicilio: row.domicilio,
    actividad_economica: row.actividad_economica,
    fecha_inscripcion: row.fecha_inscripcion,
  };
}

export function getPadronLastIngestedAt(): string | null {
  try {
    return getPadronFreshness(getPadronDb());
  } catch {
    return null;
  }
}
