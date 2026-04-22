import type { FxRatesResponse, FxIndicatorsResponse } from "@latam-mcp/schemas";
import { UpstreamError } from "./http.js";
import { fetchFxRatesDirect } from "./sbs-direct.js";

type RatesRaw = Omit<FxRatesResponse, "fetched_at" | "stale">;
type IndicatorsRaw = Omit<FxIndicatorsResponse, "fetched_at" | "stale">;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchFxRates(date?: string): Promise<RatesRaw> {
  const mode = process.env.SBS_UPSTREAM ?? "stub";
  const d = date ?? today();

  if (mode === "stub") {
    return {
      date: d,
      rates: [
        { pair: "USD/PEN", buy: 3.712, sell: 3.719 },
        { pair: "EUR/PEN", buy: 4.01, sell: 4.08 },
      ],
    };
  }

  if (mode === "direct") {
    return fetchFxRatesDirect(date);
  }

  throw new UpstreamError(`Unknown SBS_UPSTREAM mode: ${mode}`, 500);
}

export async function fetchFxIndicator(
  type: "tea" | "tipmn" | "tamn",
  date?: string,
): Promise<IndicatorsRaw> {
  const mode = process.env.SBS_UPSTREAM ?? "stub";
  const d = date ?? today();

  if (mode === "stub") {
    const stubValues: Record<string, number> = { tea: 0.0525, tipmn: 0.0225, tamn: 0.175 };
    return {
      type,
      date: d,
      value: stubValues[type] ?? 0,
      unit: "decimal_rate",
    };
  }

  throw new UpstreamError(
    `SBS indicators upstream mode '${mode}' not implemented (v1.1); use stub for now`,
    501,
  );
}
