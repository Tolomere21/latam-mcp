# Deploy

## API (Fly.io)

From repo root:

```bash
fly launch --config infra/fly.toml --no-deploy   # first time only
fly volumes create padron_data --region gru --size 10 --app latam-mcp-api
fly secrets import --app latam-mcp-api  # reads KEY=value pairs from stdin
fly deploy --config infra/fly.toml --dockerfile infra/Dockerfile
fly certs add api.latam-mcp.com --app latam-mcp-api
```

Primary region is São Paulo (`gru`) — closest Fly region to Peruvian upstream sources.

## Landing (Cloudflare Pages)

```bash
npx wrangler pages deploy apps/landing/public \
  --project-name latam-mcp \
  --branch main
```

Point your domain at the Pages deployment in the Cloudflare dashboard.

## Padrón ingestion

The api machine runs a daily scheduler at 06:00 UTC that spawns the ingest as a
child process. For a fresh/manual ingest:

```bash
fly ssh console --app latam-mcp-api -C "nohup node /app/apps/ingest/dist/index.js > /tmp/ingest.log 2>&1 &"
```

Takes roughly 2 hours for a full refresh (~18M rows).

## Smoke-test

```bash
curl https://api.latam-mcp.com/healthz
curl https://latam-mcp.com/llms.txt
curl https://api.latam-mcp.com/pe/ruc/20100017491 \
  -H "authorization: Bearer $LATAM_MCP_KEY"
```
