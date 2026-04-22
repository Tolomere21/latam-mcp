import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createApiKey, revokeKey, updateKeyPlan } from "../lib/keys.js";
import { sendEmail, welcomeEmail } from "../lib/email.js";
import { getSupabase } from "../lib/supabase.js";
import type { Plan } from "../auth.js";

export const billingRoutes = new Hono();

/**
 * Map Lemon Squeezy variant IDs to our plan identifiers. LS uses a separate
 * variant per SKU (Indie monthly vs Scale monthly), so one product can have
 * multiple variants if we ever add annual pricing.
 */
function planFromVariantId(variantId: string): Plan | null {
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_INDIE) return "indie";
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_SCALE) return "scale";
  return null;
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type LsWebhook = {
  meta: { event_name: string; custom_data?: Record<string, unknown> };
  data: {
    type: string;
    id: string;
    attributes: {
      customer_id: number;
      user_email?: string;
      variant_id?: number;
      status?: string;
    };
  };
};

billingRoutes.post("/webhook", async (c) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return c.json(
      { error: { code: "not_configured", message: "LEMONSQUEEZY_WEBHOOK_SECRET not set" } },
      503,
    );
  }

  const sig = c.req.header("x-signature");
  if (!sig) return c.json({ error: { code: "missing_signature" } }, 400);

  const raw = await c.req.text();
  if (!verifySignature(raw, sig, secret)) {
    return c.json({ error: { code: "bad_signature" } }, 400);
  }

  let event: LsWebhook;
  try {
    event = JSON.parse(raw) as LsWebhook;
  } catch {
    return c.json({ error: { code: "bad_json" } }, 400);
  }

  const sb = getSupabase();
  const eventId = `ls:${event.meta.event_name}:${event.data.id}:${event.data.attributes.status ?? ""}`;
  const seen = await sb.from("billing_events").select("id").eq("id", eventId).maybeSingle();
  if (seen.data) return c.json({ received: true, duplicate: true });

  try {
    const customerId = String(event.data.attributes.customer_id);
    const variantId = String(event.data.attributes.variant_id ?? "");
    const plan = planFromVariantId(variantId);

    switch (event.meta.event_name) {
      case "subscription_created": {
        const email = event.data.attributes.user_email;
        if (!email) throw new Error("no user_email on subscription");
        if (!plan) throw new Error(`unknown variant ${variantId}`);
        const { key } = await createApiKey({
          email,
          plan,
          billingCustomerId: customerId,
        });
        await sendEmail(welcomeEmail({ email, key, plan }));
        break;
      }
      case "subscription_updated":
      case "subscription_resumed":
      case "subscription_unpaused": {
        if (plan) await updateKeyPlan({ billingCustomerId: customerId, plan });
        break;
      }
      case "subscription_cancelled":
      case "subscription_expired":
      case "subscription_paused": {
        await revokeKey(customerId);
        break;
      }
      case "subscription_payment_failed": {
        console.warn(`[ls] payment failed: customer=${customerId}`);
        break;
      }
    }
    await sb.from("billing_events").insert({ id: eventId });
    return c.json({ received: true });
  } catch (err) {
    console.error(`[ls] handler for ${event.meta.event_name} failed:`, err);
    return c.json(
      { error: { code: "handler_failed", message: (err as Error).message } },
      500,
    );
  }
});
