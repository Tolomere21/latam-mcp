import type { MiddlewareHandler } from "hono";
import { getPrincipal } from "./auth.js";

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Token-bucket rate limiter keyed by principal. Capacity = rate_rps (burst),
 * refill = rate_rps per second. In-memory; single-instance. For horizontal
 * scale, swap with Upstash Redis `rate-limit` primitive.
 */
export const rateLimit: MiddlewareHandler = async (c, next) => {
  const p = getPrincipal(c);
  const now = Date.now();
  const b = buckets.get(p.keyId) ?? { tokens: p.rate_rps, updatedAt: now };
  const elapsedS = (now - b.updatedAt) / 1000;
  const refilled = Math.min(p.rate_rps, b.tokens + elapsedS * p.rate_rps);
  if (refilled < 1) {
    const retryS = Math.ceil((1 - refilled) / p.rate_rps);
    buckets.set(p.keyId, { tokens: refilled, updatedAt: now });
    return c.json(
      { error: { code: "rate_limited", message: `Rate limit exceeded (${p.rate_rps} rps)`, retry_after_s: retryS } },
      429,
    );
  }
  buckets.set(p.keyId, { tokens: refilled - 1, updatedAt: now });
  await next();
};
