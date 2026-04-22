import { getSupabase } from "./supabase.js";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Atomically upserts today's monthly counter for the given key.
 * Uses a Postgres function if available; falls back to select/insert/update
 * transaction when the function isn't set up.
 */
export async function incrementUsageDb(keyId: string): Promise<number> {
  const sb = getSupabase();
  const month = currentMonth();
  const { data, error } = await sb.rpc("increment_usage", {
    p_key_id: keyId,
    p_month: month,
  });
  if (!error && typeof data === "number") return data;

  const { data: existing } = await sb
    .from("usage_counters")
    .select("calls")
    .eq("key_id", keyId)
    .eq("month", month)
    .maybeSingle();
  if (existing) {
    const next = (existing.calls as number) + 1;
    await sb
      .from("usage_counters")
      .update({ calls: next })
      .eq("key_id", keyId)
      .eq("month", month);
    return next;
  }
  await sb.from("usage_counters").insert({ key_id: keyId, month, calls: 1 });
  return 1;
}

export async function getUsageDb(keyId: string): Promise<{ month: string; calls: number }> {
  const sb = getSupabase();
  const month = currentMonth();
  const { data } = await sb
    .from("usage_counters")
    .select("calls")
    .eq("key_id", keyId)
    .eq("month", month)
    .maybeSingle();
  return { month, calls: (data?.calls as number) ?? 0 };
}
