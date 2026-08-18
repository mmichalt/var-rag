# syntax=docker/dockerfile:1

FROM node:24.19.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY libs/config/package.json libs/config/package.json
COPY libs/database/package.json libs/database/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec nx build web

FROM node:24.19.0-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN useradd --create-home --uid 1001 appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/apps/web/.next/standalone ./
COPY --from=build --chown=appuser:appuser /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=appuser:appuser /app/apps/web/public ./apps/web/public
USER appuser
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
