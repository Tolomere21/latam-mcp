/**
 * Parse one line of SUNAT's padrón reducido pipe-delimited format.
 *
 * The file has evolved slightly over the years. The canonical layout is 15
 * fields: RUC | RAZÓN SOCIAL | ESTADO | CONDICIÓN | UBIGEO | TIPO_VIA |
 * NOMBRE_VIA | COD_ZONA | TIPO_ZONA | NUMERO | INTERIOR | LOTE | DPTO |
 * MANZANA | KILOMETRO. We're defensive: we require at least the first four
 * (RUC, razón, estado, condición) and compose the address from whatever
 * remains.
 */

export type PadronRow = {
  ruc: string;
  razon_social: string;
  estado: string | null;
  condicion: string | null;
  tipo_contribuyente: string | null;
  domicilio: string | null;
  ubigeo: string | null;
};

export function parsePadronLine(line: string): PadronRow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split("|").map((p) => p.trim());
  if (parts.length < 4) return null;

  const ruc = parts[0] ?? "";
  if (!/^\d{11}$/.test(ruc)) return null;

  const razon = parts[1] ?? "";
  if (!razon) return null;

  const estado = parts[2] ?? null;
  const condicion = parts[3] ?? null;
  const ubigeo = parts[4] ?? null;

  const addressParts = [
    joinNonEmpty([parts[5], parts[6]]), // TIPO_VIA + NOMBRE_VIA
    joinNonEmpty([parts[7], parts[8]]), // COD_ZONA + TIPO_ZONA
    prefix("NRO. ", parts[9]),
    prefix("INT. ", parts[10]),
    prefix("LOTE ", parts[11]),
    prefix("DPTO ", parts[12]),
    prefix("MZA. ", parts[13]),
    prefix("KM. ", parts[14]),
  ].filter((p): p is string => p.length > 0);
  const domicilio = addressParts.length ? addressParts.join(" ") : null;

  return {
    ruc,
    razon_social: razon,
    estado,
    condicion,
    tipo_contribuyente: null,
    domicilio,
    ubigeo,
  };
}

function joinNonEmpty(xs: (string | undefined)[]): string {
  const cleaned = xs
    .map((x) => (x ?? "").trim())
    .filter((x) => x.length > 0 && x !== "-");
  return cleaned.join(" ");
}

function prefix(p: string, v: string | undefined): string {
  const t = (v ?? "").trim();
  if (!t || t === "-") return "";
  return `${p}${t}`;
}
