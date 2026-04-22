import type { MiddlewareHandler } from "hono";

/**
 * Per-IP rate limiter specifically for /signup. Unauthenticated endpoint that
 * mints API keys + sends emails — prime abuse target without a cap.
 *
 * Limits:
 *   - 3 signups / hour / IP
 *   - 10 signups / day / IP
 *
 * In-memory. Fine for single-machine. If we ever add a second machine, swap for
 * Upstash Redis or similar — but the $20 cap forbids adding that right now.
 */

type Bucket = { count: number; resetAt: number };
const hourly = new Map<string, Bucket>();
const daily = new Map<string, Bucket>();

const HOUR_LIMIT = 3;
const DAY_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function tick(map: Map<string, Bucket>, key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  const b = map.get(key);
  if (!b || now >= b.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  b.count += 1;
  if (b.count > limit) return Math.ceil((b.resetAt - now) / 1000);
  return 0;
}

function clientIp(c: { req: { header(name: string): string | undefined }; env?: unknown }): string {
  const headers = c.req;
  const xff = headers.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = headers.header("fly-client-ip") ?? headers.header("x-real-ip");
  if (real) return real;
  return "unknown";
}

export const signupRateLimit: MiddlewareHandler = async (c, next) => {
  const ip = clientIp(c);
  const hourRetry = tick(hourly, ip, HOUR_LIMIT, HOUR_MS);
  if (hourRetry > 0) {
    return c.json(
      {
        error: {
          code: "rate_limited",
          message: `Too many signups from this IP. Try again in ${hourRetry}s.`,
          retry_after_s: hourRetry,
        },
      },
      429,
    );
  }
  const dayRetry = tick(daily, ip, DAY_LIMIT, DAY_MS);
  if (dayRetry > 0) {
    return c.json(
      {
        error: {
          code: "rate_limited",
          message: `Daily signup limit reached for this IP. Try again in ${Math.ceil(dayRetry / 3600)}h.`,
          retry_after_s: dayRetry,
        },
      },
      429,
    );
  }
  await next();
};
