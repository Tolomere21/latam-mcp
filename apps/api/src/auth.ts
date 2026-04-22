import type { Context, MiddlewareHandler } from "hono";
import { isSupabaseConfigured } from "./lib/supabase.js";
import { lookupKey, type ApiKeyRecord } from "./lib/keys.js";

export type Plan = "free" | "indie" | "scale";

export type Principal = {
  keyId: string;
  plan: Plan;
  rate_rps: number;
  included_calls: number;
  email?: string;
};

const PLAN_LIMITS: Record<Plan, { rate_rps: number; included_calls: number }> = {
  free: { rate_rps: 10, included_calls: 1000 },
  indie: { rate_rps: 50, included_calls: 25000 },
  scale: { rate_rps: 200, included_calls: 250000 },
};

/**
 * Dev-mode key resolver: reads a comma-separated list of `key:plan` pairs
 * from LATAM_MCP_DEV_KEYS. Only used when Supabase isn't configured.
 */
function resolveDevKey(raw: string): Principal | null {
  const list = (process.env.LATAM_MCP_DEV_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const entry of list) {
    const [k, p] = entry.split(":");
    if (k === raw) {
      const plan = ((p ?? "free") as Plan);
      return { keyId: `dev:${k}`, plan, ...PLAN_LIMITS[plan] };
    }
  }
  return null;
}

async function resolveSupabaseKey(raw: string): Promise<Principal | null> {
  let record: ApiKeyRecord | null;
  try {
    record = await lookupKey(raw);
  } catch (err) {
    console.error("[auth] supabase lookup failed:", (err as Error).message);
    return null;
  }
  if (!record) return null;
  return {
    keyId: record.id,
    plan: record.plan,
    email: record.email,
    ...PLAN_LIMITS[record.plan],
  };
}

export const requireApiKey: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return c.json(
      { error: { code: "unauthorized", message: "Missing or malformed Authorization header" } },
      401,
    );
  }
  const key = match[1]!;

  let principal: Principal | null = null;
  if (isSupabaseConfigured()) {
    principal = await resolveSupabaseKey(key);
  }
  if (!principal) {
    principal = resolveDevKey(key);
  }

  if (!principal) {
    return c.json({ error: { code: "unauthorized", message: "Invalid API key" } }, 401);
  }
  c.set("principal", principal);
  await next();
};

export function getPrincipal(c: Context): Principal {
  const p = c.get("principal") as Principal | undefined;
  if (!p) throw new Error("principal not set — requireApiKey middleware missing");
  return p;
}

export { PLAN_LIMITS };
