import { Hono } from "hono";
import { RucParam, type RucResponse, type ErrorEnvelope } from "@latam-mcp/schemas";
import { TtlCache, cachedUpstream } from "../cache.js";
import { fetchRucFromSunat } from "../upstream/sunat.js";
import { UpstreamError } from "../upstream/http.js";

const RUC_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new TtlCache<RucResponse>(5000);

export const rucRoutes = new Hono();

rucRoutes.get("/:ruc", async (c) => {
  const parsed = RucParam.safeParse(c.req.param("ruc"));
  if (!parsed.success) {
    const body: ErrorEnvelope = {
      error: { code: "invalid_ruc", message: parsed.error.issues[0]?.message ?? "Invalid RUC" },
    };
    return c.json(body, 400);
  }
  const ruc = parsed.data;

  try {
    const { value, status } = await cachedUpstream(cache, ruc, RUC_TTL_MS, async () => {
      const raw = await fetchRucFromSunat(ruc);
      return { ...raw, fetched_at: new Date().toISOString(), stale: false } satisfies RucResponse;
    });
    c.header("X-Cache", status);
    if (status === "STALE") c.header("X-Cache-Stale", "true");
    return c.json(status === "STALE" ? { ...value, stale: true } : value);
  } catch (err) {
    if (err instanceof UpstreamError) {
      const code =
        err.status === 404
          ? "not_found"
          : err.status === 401 || err.status === 403
            ? "upstream_auth"
            : err.status === 429
              ? "rate_limited"
              : err.status === 503
                ? "service_unavailable"
                : "upstream_unavailable";
      const httpStatus =
        err.status === 404
          ? 404
          : err.status === 429
            ? 429
            : err.status === 503
              ? 503
              : 502;
      const body: ErrorEnvelope = {
        error: {
          code,
          message: err.message,
          retry_after_s: err.retryAfterS,
          upstream_status: err.status === 404 ? undefined : err.status,
        },
      };
      return c.json(body, httpStatus);
    }
    console.error("[ruc] unexpected error:", err);
    const body: ErrorEnvelope = {
      error: { code: "internal_error", message: "Unexpected error" },
    };
    return c.json(body, 500);
  }
});
