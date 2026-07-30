# syntax=docker/dockerfile:1
# Multi-stage build for @rant/web. Build context is the monorepo ROOT:
#   docker build -f apps/web/Dockerfile -t rant-web .

# ── base ─────────────────────────────────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/database/package.json packages/database/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ── build ────────────────────────────────────────────────────
FROM deps AS build
# Public API URL is inlined at build time. Override with:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com ...
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Emit the standalone server bundle (Linux build; safe here).
ENV NEXT_OUTPUT=standalone
COPY apps/web apps/web
RUN pnpm --filter @rant/web build

# ── runtime (Next.js standalone) ─────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
