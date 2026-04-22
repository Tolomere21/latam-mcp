import { Hono } from "hono";
import { getPrincipal } from "../auth.js";
import { getUsageSomewhere } from "../usage.js";

export const meRoutes = new Hono();

meRoutes.get("/usage", async (c) => {
  const p = getPrincipal(c);
  const u = await getUsageSomewhere(p.keyId);
  return c.json({
    key_id: p.keyId,
    plan: p.plan,
    rate_rps: p.rate_rps,
    included_calls: p.included_calls,
    month: u.month,
    calls_this_month: u.calls,
    overage: Math.max(0, u.calls - p.included_calls),
  });
});
