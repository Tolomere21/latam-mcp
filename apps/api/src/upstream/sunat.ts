import type { RucResponse } from "@latam-mcp/schemas";
import { fetchJson, UpstreamError } from "./http.js";
import { fetchRucFromPadron } from "./sunat-padron.js";

export { UpstreamError } from "./http.js";

type Raw = Omit<RucResponse, "fetched_at" | "stale">;

/**
 * Mask natural-person RUCs (prefix "10") to reduce exposure of individual
 * taxpayer data under Peru's Ley 29733. Business entities (prefix "20") are
 * commercial records and returned in full.
 */
function maskIfNaturalPerson(raw: Raw): Raw {
  if (raw.ruc.startsWith("10")) {
    return { ...raw, razon_social: "[natural person — masked]" };
  }
  return raw;
}

export async function fetchRucFromSunat(ruc: string): Promise<Raw> {
  const mode = process.env.SUNAT_UPSTREAM ?? "padron";

  if (mode === "stub") {
    return maskIfNaturalPerson({
      ruc,
      razon_social: `TEST RAZON SOCIAL ${ruc}`,
      estado: "ACTIVO",
      condicion: "HABIDO",
      domicilio: "AV. TEST 123 - LIMA",
      actividad_economica: "STUB - testing",
      fecha_inscripcion: "2001-01-01",
    });
  }

  if (mode === "padron") {
    return maskIfNaturalPerson(fetchRucFromPadron(ruc));
  }

  if (mode === "custom") {
    const base = process.env.SUNAT_UPSTREAM_URL;
    if (!base) throw new UpstreamError("SUNAT_UPSTREAM_URL not set", 500);
    const data = await fetchJson<Raw>(`${base}/${encodeURIComponent(ruc)}`);
    return maskIfNaturalPerson(data);
  }

  throw new UpstreamError(
    `Unknown SUNAT_UPSTREAM mode: ${mode}. Valid: stub | padron | custom.`,
    500,
  );
}
