import { Hono, type Context } from "hono";
import {
  FxRatesQuery,
  FxIndicatorsQuery,
  type FxRatesResponse,
  type FxIndicatorsResponse,
  type ErrorEnvelope,
} from "@latam-mcp/schemas";
import { TtlCache, cachedUpstream } from "../cache.js";
import { fetchFxRates, fetchFxIndicator } from "../upstream/sbs.js";
import { UpstreamError } from "../upstream/http.js";

const FX_TTL_MS = 12 * 60 * 60 * 1000;
const ratesCache = new TtlCache<FxRatesResponse>(2000);
const indicatorsCache = new TtlCache<FxIndicatorsResponse>(2000);

export const fxRoutes = new Hono();

fxRoutes.get("/rates", async (c) => {
  const parsed = FxRatesQuery.safeParse({ date: c.req.query("date") });
  if (!parsed.success) {
    const body: ErrorEnvelope = {
      error: { code: "invalid_query", message: parsed.error.issues[0]?.message ?? "Invalid query" },
    };
    return c.json(body, 400);
  }
  const key = parsed.data.date ?? "today";
  try {
    const { value, status } = await cachedUpstream(ratesCache, key, FX_TTL_MS, async () => {
      const raw = await fetchFxRates(parsed.data.date);
      return { ...raw, fetched_at: new Date().toISOString(), stale: false } satisfies FxRatesResponse;
    });
    c.header("X-Cache", status);
    if (status === "STALE") c.header("X-Cache-Stale", "true");
    return c.json(status === "STALE" ? { ...value, stale: true } : value);
  } catch (err) {
    return upstreamErrorResponse(c, err);
  }
});

fxRoutes.get("/indicators", async (c) => {
  const parsed = FxIndicatorsQuery.safeParse({
    type: c.req.query("type"),
    date: c.req.query("date"),
  });
  if (!parsed.success) {
    const body: ErrorEnvelope = {
      error: { code: "invalid_query", message: parsed.error.issues[0]?.message ?? "Invalid query" },
    };
    return c.json(body, 400);
  }
  const key = `${parsed.data.type}:${parsed.data.date ?? "today"}`;
  try {
    const { value, status } = await cachedUpstream(indicatorsCache, key, FX_TTL_MS, async () => {
      const raw = await fetchFxIndicator(parsed.data.type, parsed.data.date);
      return { ...raw, fetched_at: new Date().toISOString(), stale: false } satisfies FxIndicatorsResponse;
    });
    c.header("X-Cache", status);
    if (status === "STALE") c.header("X-Cache-Stale", "true");
    return c.json(status === "STALE" ? { ...value, stale: true } : value);
  } catch (err) {
    return upstreamErrorResponse(c, err);
  }
});

function upstreamErrorResponse(c: Context, err: unknown) {
  if (err instanceof UpstreamError) {
    const body: ErrorEnvelope = {
      error: {
        code: "upstream_unavailable",
        message: err.message,
        retry_after_s: err.retryAfterS,
        upstream_status: err.status,
      },
    };
    return c.json(body, 502);
  }
  const body: ErrorEnvelope = { error: { code: "internal_error", message: "Unexpected error" } };
  return c.json(body, 500);
}
