import { createHash, randomBytes } from "node:crypto";
import { getSupabase } from "./supabase.js";
import type { Plan } from "../auth.js";

/**
 * API keys are generated as `lm_<32 bytes base64url>` and never stored in
 * plaintext. We store only sha256(key + pepper) so a DB leak doesn't expose
 * working keys.
 */
export function generateKey(): string {
  const raw = randomBytes(32).toString("base64url");
  return `lm_${raw}`;
}

export function hashKey(key: string): string {
  const pepper = process.env.API_KEY_HASH_SECRET;
  if (!pepper) throw new Error("API_KEY_HASH_SECRET not set");
  return createHash("sha256").update(`${pepper}:${key}`).digest("hex");
}

export type ApiKeyRecord = {
  id: string;
  email: string;
  plan: Plan;
  billing_customer_id: string | null;
  revoked_at: string | null;
};

export async function lookupKey(key: string): Promise<ApiKeyRecord | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("api_keys")
    .select("id, email, plan, billing_customer_id, revoked_at")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  return data as ApiKeyRecord;
}

export async function createApiKey(params: {
  email: string;
  plan: Plan;
  billingCustomerId?: string | null;
}): Promise<{ id: string; key: string }> {
  const sb = getSupabase();
  const key = generateKey();
  const { data, error } = await sb
    .from("api_keys")
    .insert({
      key_hash: hashKey(key),
      email: params.email,
      plan: params.plan,
      billing_customer_id: params.billingCustomerId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createApiKey failed: ${error?.message ?? "unknown"}`);
  return { id: data.id as string, key };
}

export async function updateKeyPlan(params: {
  billingCustomerId: string;
  plan: Plan;
}): Promise<void> {
  const sb = getSupabase();
  await sb
    .from("api_keys")
    .update({ plan: params.plan })
    .eq("billing_customer_id", params.billingCustomerId);
}

export async function revokeKey(billingCustomerId: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("billing_customer_id", billingCustomerId);
}
