import { Hono } from "hono";
import { z } from "zod";
import { isSupabaseConfigured } from "../lib/supabase.js";
import { createApiKey } from "../lib/keys.js";
import { sendEmail, welcomeEmail } from "../lib/email.js";
import { signupRateLimit } from "../signup-rate-limit.js";

const SignupBody = z.object({
  email: z.string().email(),
});

/**
 * Free-tier signup — anyone can request a key without payment. Returns the
 * key in the response body AND emails it, so a user who loses the email can
 * still grab it from the response on signup.
 *
 * Paid tiers are provisioned by the Stripe webhook, not this route.
 */
export const signupRoutes = new Hono();

signupRoutes.use("*", signupRateLimit);

signupRoutes.post("/", async (c) => {
  if (!isSupabaseConfigured()) {
    return c.json(
      { error: { code: "not_configured", message: "Signup requires Supabase to be configured" } },
      503,
    );
  }
  const body = await c.req.json().catch(() => null);
  const parsed = SignupBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_body", message: parsed.error.issues[0]?.message ?? "Invalid body" } },
      400,
    );
  }

  const { key } = await createApiKey({ email: parsed.data.email, plan: "free" });
  await sendEmail(welcomeEmail({ email: parsed.data.email, key, plan: "free" }));

  return c.json({
    email: parsed.data.email,
    plan: "free",
    api_key: key,
    included_calls: 1000,
    rate_rps: 10,
    docs: "https://latam-mcp.com/llms.txt",
  });
});
