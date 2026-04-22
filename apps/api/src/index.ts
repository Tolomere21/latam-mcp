import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { rucRoutes } from "./routes/ruc.js";
import { fxRoutes } from "./routes/fx.js";
import { seaceRoutes } from "./routes/seace.js";
import { meRoutes } from "./routes/me.js";
import { signupRoutes } from "./routes/signup.js";
import { billingRoutes } from "./routes/billing.js";
import { requireApiKey } from "./auth.js";
import { rateLimit } from "./rate-limit.js";
import { trackUsage } from "./usage.js";
import { startIngestScheduler } from "./lib/ingest-scheduler.js";

const app = new Hono();

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  c.header("X-Response-Time-Ms", String(Date.now() - start));
});

app.get("/healthz", (c) => c.json({ ok: true, service: "latam-mcp-api" }));

app.get("/pricing.json", (c) =>
  c.json({
    $schema: "https://latam-mcp.com/schema/pricing.v1.json",
    service: "latam-mcp",
    currency: "USD",
    per_call_usd: 0.002,
    plans: [
      { id: "free", price_usd_month: 0, included_calls: 1000, rate_rps: 10, webhooks: false },
      { id: "indie", price_usd_month: 19, included_calls: 25000, rate_rps: 50, webhooks: false },
      { id: "scale", price_usd_month: 99, included_calls: 250000, rate_rps: 200, webhooks: true },
    ],
    overage_usd_per_call: 0.002,
    annual_discount: "2 months free",
  }),
);

app.route("/signup", signupRoutes);
app.route("/billing", billingRoutes);

const protectedApp = new Hono();
protectedApp.use("*", requireApiKey, rateLimit, trackUsage);
protectedApp.route("/pe/ruc", rucRoutes);
protectedApp.route("/pe/fx", fxRoutes);
protectedApp.route("/pe/seace", seaceRoutes);
protectedApp.route("/me", meRoutes);

app.route("/", protectedApp);

app.notFound((c) =>
  c.json({ error: { code: "not_found", message: `No route for ${c.req.method} ${c.req.path}` } }, 404),
);

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`latam-mcp api listening on http://localhost:${port}`);

startIngestScheduler();
