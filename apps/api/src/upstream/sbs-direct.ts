import type { FxRatesResponse } from "@latam-mcp/schemas";
import { UpstreamError } from "./http.js";

type Raw = Omit<FxRatesResponse, "fetched_at" | "stale">;

/**
 * Upstream: Banco Central de Reserva del Perú (BCRP) — the central bank.
 *
 * BCRP publishes the same SBS-sourced exchange-rate data via an open JSON API
 * with no authentication, no captcha, and no bot-protection layer. This is the
 * most reliable upstream available for Peruvian FX.
 *
 * Series codes used:
 *   PD04639PD — USD Compra (buy)
 *   PD04640PD — USD Venta (sell)
 *   PD04647PD — EUR Compra
 *   PD04648PD — EUR Venta
 *
 * Docs: https://estadisticas.bcrp.gob.pe/estadisticas/series/ayuda/api
 */

const UA = "latam-mcp/0.0.0 (+https://latam-mcp.com)";
const TIMEOUT_MS = 10_000;
const SERIES = ["PD04639PD", "PD04640PD", "PD04647PD", "PD04648PD"] as const;

type BcrpResponse = {
  config: { series: { name: string; dec: string }[] };
  periods: { name: string; values: string[] }[];
};

const MONTHS_ES: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", set: "09", sep: "09", oct: "10", nov: "11", dic: "12",
};

function parseBcrpDate(name: string): string | null {
  const m = /^(\d{2})\.([A-Za-zñÑ]{3,4})\.(\d{2,4})$/.exec(name.trim());
  if (!m) return null;
  const day = m[1]!;
  const mon = MONTHS_ES[m[2]!.toLowerCase().slice(0, 3)];
  if (!mon) return null;
  const rawYear = m[3]!;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${mon}-${day}`;
}

export async function fetchFxRatesDirect(date?: string): Promise<Raw> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let json: BcrpResponse;
  try {
    const url = `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/${SERIES.join("-")}/json`;
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: ctl.signal,
    });
    if (!res.ok) throw new UpstreamError(`BCRP ${res.status}`, res.status);
    json = (await res.json()) as BcrpResponse;
  } finally {
    clearTimeout(timer);
  }

  if (!json.periods?.length) {
    throw new UpstreamError("BCRP returned no data points", 502);
  }

  const chosen = date
    ? json.periods.find((p) => parseBcrpDate(p.name) === date) ??
      (() => {
        throw new UpstreamError(`No BCRP rate published for ${date}`, 404);
      })()
    : json.periods[json.periods.length - 1]!;

  const isoDate = parseBcrpDate(chosen.name) ?? new Date().toISOString().slice(0, 10);

  const toNumber = (s: string | undefined) => {
    if (!s || s === "n.d.") return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const usdBuy = toNumber(chosen.values[0]);
  const usdSell = toNumber(chosen.values[1]);
  const eurBuy = toNumber(chosen.values[2]);
  const eurSell = toNumber(chosen.values[3]);

  const rates: Raw["rates"] = [];
  if (usdBuy != null && usdSell != null) rates.push({ pair: "USD/PEN", buy: usdBuy, sell: usdSell });
  if (eurBuy != null && eurSell != null) rates.push({ pair: "EUR/PEN", buy: eurBuy, sell: eurSell });

  if (rates.length === 0) {
    throw new UpstreamError("BCRP data point has no valid USD or EUR rates", 502);
  }

  return { date: isoDate, rates };
}
