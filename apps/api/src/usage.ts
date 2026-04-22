import type { MiddlewareHandler } from "hono";
import { getPrincipal } from "./auth.js";
import { isSupabaseConfigured } from "./lib/supabase.js";
import { incrementUsageDb, getUsageDb } from "./lib/usage-db.js";

type Counter = { month: string; calls: number };
const memCounters = new Map<string, Counter>();

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function incrementUsage(keyId: string): number {
  const month = currentMonth();
  const existing = memCounters.get(keyId);
  if (!existing || existing.month !== month) {
    memCounters.set(keyId, { month, calls: 1 });
    return 1;
  }
  existing.calls += 1;
  return existing.calls;
}

export function getUsage(keyId: string): { month: string; calls: number } {
  return memCounters.get(keyId) ?? { month: currentMonth(), calls: 0 };
}

export async function getUsageSomewhere(keyId: string): Promise<{ month: string; calls: number }> {
  if (isSupabaseConfigured() && !keyId.startsWith("dev:")) {
    return getUsageDb(keyId);
  }
  return getUsage(keyId);
}

export const trackUsage: MiddlewareHandler = async (c, next) => {
  const p = getPrincipal(c);
  let calls: number;
  if (isSupabaseConfigured() && !p.keyId.startsWith("dev:")) {
    calls = await incrementUsageDb(p.keyId).catch((err) => {
      console.error("[usage] supabase increment failed, falling back to mem:", err.message);
      return incrementUsage(p.keyId);
    });
  } else {
    calls = incrementUsage(p.keyId);
  }
  c.header("X-Usage-Calls", String(calls));
  c.header("X-Usage-Limit", String(p.included_calls));
  if (calls > p.included_calls) {
    c.header("X-Usage-Overage", "true");
  }
  await next();
};
