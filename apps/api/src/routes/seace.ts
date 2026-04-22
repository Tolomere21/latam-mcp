import { Hono } from "hono";
import {
  TenderSearchQuery,
  type TenderSearchResponse,
  type ErrorEnvelope,
} from "@latam-mcp/schemas";
import { TtlCache, cachedUpstream } from "../cache.js";
import { fetchSeaceTenders } from "../upstream/seace.js";
import { UpstreamError } from "../upstream/http.js";

const SEACE_TTL_MS = 60 * 60 * 1000;
const cache = new TtlCache<TenderSearchResponse>(2000);

export const seaceRoutes = new Hono();

seaceRoutes.get("/tenders", async (c) => {
  const parsed = TenderSearchQuery.safeParse({
    query: c.req.query("query"),
    region: c.req.query("region"),
    since: c.req.query("since"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    const body: ErrorEnvelope = {
      error: { code: "invalid_query", message: parsed.error.issues[0]?.message ?? "Invalid query" },
    };
    return c.json(body, 400);
  }

  const key = JSON.stringify(parsed.data);
  try {
    const { value, status } = await cachedUpstream(cache, key, SEACE_TTL_MS, async () => {
      const raw = await fetchSeaceTenders(parsed.data);
      return { ...raw, fetched_at: new Date().toISOString(), stale: false } satisfies TenderSearchResponse;
    });
    c.header("X-Cache", status);
    if (status === "STALE") c.header("X-Cache-Stale", "true");
    return c.json(status === "STALE" ? { ...value, stale: true } : value);
  } catch (err) {
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
});
