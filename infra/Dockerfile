FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache python3 make g++
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY apps/api/package.json ./apps/api/
COPY apps/mcp/package.json ./apps/mcp/
COPY apps/ingest/package.json ./apps/ingest/
COPY apps/landing/package.json ./apps/landing/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @latam-mcp/schemas build
RUN pnpm --filter @latam-mcp/api build
RUN pnpm --filter @latam-mcp/ingest build

FROM node:20-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/tsconfig.base.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/ingest ./apps/ingest
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8787
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/index.js"]
