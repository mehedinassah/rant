# syntax=docker/dockerfile:1
# Multi-stage build for @rant/api. Build context is the monorepo ROOT:
#   docker build -f apps/api/Dockerfile -t rant-api .

# ── base ─────────────────────────────────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# openssl is required by Prisma's query engine at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

# ── deps (cached on manifests) ───────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/database/package.json packages/database/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ── build ────────────────────────────────────────────────────
FROM deps AS build
COPY packages/database packages/database
COPY apps/api apps/api
RUN pnpm --filter @rant/database build \
  && pnpm --filter @rant/api build

# ── runtime ──────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# Full node_modules (incl. the prisma CLI) so the container can self-migrate.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/database ./packages/database
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./apps/api/docker-entrypoint.sh"]
