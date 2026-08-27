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
COPY libs/rag/package.json libs/rag/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec nx build api && pnpm exec nx build config && pnpm exec nx build database && pnpm exec nx build rag

FROM node:24.19.0-bookworm-slim AS runner
ENV NODE_ENV=production
RUN useradd --create-home --uid 1001 appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=appuser:appuser /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=appuser:appuser /app/libs/config/dist ./libs/config/dist
COPY --from=build --chown=appuser:appuser /app/libs/config/package.json ./libs/config/package.json
COPY --from=build --chown=appuser:appuser /app/libs/database/dist ./libs/database/dist
COPY --from=build --chown=appuser:appuser /app/libs/database/package.json ./libs/database/package.json
COPY --from=build --chown=appuser:appuser /app/libs/database/node_modules ./libs/database/node_modules
COPY --from=build --chown=appuser:appuser /app/libs/database/prisma ./libs/database/prisma
COPY --from=build --chown=appuser:appuser /app/libs/database/prisma.config.ts ./libs/database/prisma.config.ts
COPY --from=build --chown=appuser:appuser /app/libs/rag/dist ./libs/rag/dist
COPY --from=build --chown=appuser:appuser /app/libs/rag/package.json ./libs/rag/package.json
COPY --from=build --chown=appuser:appuser /app/package.json ./package.json
COPY --from=build --chown=appuser:appuser /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
USER appuser
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
