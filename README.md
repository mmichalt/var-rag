# Football VAR Decision Explorer

Retrieval-augmented system for asking football law questions, finding comparable VAR or refereeing incidents, and comparing official decisions. Answers must stay grounded in approved sources. Product requirements live in `docs/Football_VAR_RAG_Requirements_v0.1.md`.

This repository is a pnpm/Nx monorepo:

| App or service        | Role                                        |
| --------------------- | ------------------------------------------- |
| `apps/web`            | Next.js App Router UI                       |
| `apps/api`            | NestJS HTTP API                             |
| `apps/worker`         | NestJS background worker                    |
| PostgreSQL + pgvector | Relational store and vector search          |
| Redis                 | BullMQ job backend                          |
| MinIO                 | Optional local S3-compatible object storage |

The API does not run ingestion or indexing synchronously. Those jobs belong on the worker. Privileged corpus commands are CLI-only (no HTTP ingest/publish endpoints).

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- Corepack, which pins pnpm via the root `packageManager` field
- Docker with Compose, for PostgreSQL, Redis, and optional MinIO

```bash
corepack enable
corepack prepare pnpm@11.22.0 --activate
```

## First-time setup

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate
```

`.env` is untracked. `.env.example` contains development placeholders only and must not be used as production credentials.

## Start applications

```bash
pnpm dev          # web, api, and worker
pnpm dev:web      # http://localhost:3000
pnpm dev:api      # http://localhost:3001/api/v1
pnpm dev:worker   # no HTTP port
```

Useful local URLs:

```text
Web:         http://localhost:3000
API:         http://localhost:3001/api/v1
Swagger:     http://localhost:3001/api/docs
OpenAPI:     http://localhost:3001/api/docs-json
Liveness:    http://localhost:3001/api/v1/health/live
Readiness:   http://localhost:3001/api/v1/health/ready
MinIO UI:    http://localhost:9001   # only with object-storage profile
```

## Infrastructure

```bash
pnpm infra:up      # postgres + redis
pnpm infra:down
pnpm infra:logs
```

Optional object storage (creates bucket `football-rag-sources`):

```bash
docker compose --profile object-storage up -d
```

Local Ollama (not used by CI):

```bash
docker compose --profile models up -d
```

Full container stack:

```bash
docker compose --profile app up --build
```

The app profile uses `postgres:5432`, `redis:6379`, and `api:3001` on the Compose network. Application images do not bake `.env` files.

## Migrations

Schema changes go through Prisma. The schema lives in `libs/database/prisma/schema.prisma`. Do not use `prisma db push` against a shared database.

```bash
pnpm db:migrate
pnpm db:migration:create -- --name add_something
pnpm db:migration:generate -- --name add_something
```

`pnpm db:migrate` builds `database` (which generates Prisma Client) and runs `prisma migrate deploy`. Production containers use that compiled entrypoint, not TypeScript source paths. The API image must include `libs/database/prisma` and `libs/database/prisma.config.ts`.

`create` writes an empty SQL migration. `generate` diffs the Prisma schema and applies the result locally. Prisma migrations are forward-only: undo a change by adding a new migration with the reverse SQL.

The initial migration enables `pgvector` with `CREATE EXTENSION IF NOT EXISTS vector`. If a local database already applied the previous TypeORM migration, `pnpm db:migrate` records that SQL in `_prisma_migrations` instead of failing on a non-empty schema.

Prisma Client is generated into `libs/database/src/generated` and is not committed. Build and typecheck targets generate it first.

## Quality

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Integration checks for API readiness, worker startup, and the Ask the Laws slice run in CI when `DATABASE_URL` and `REDIS_URL` are set. Local `pnpm test` skips them so a missing database does not fail unit tests.

## Ask the Laws

The first product slice answers association-football law questions from a **synthetic two-edition corpus**. Real IFAB text is not ingested; `docs/corpus.md` records the rights finding.

```bash
pnpm corpus:ingest -- --file data/synthetic-lawbook-2025-26.pdf --family synthetic-lawbook --edition 2025/26 --url https://example.invalid/lawbook/2025-26 --fake-embedder
pnpm corpus:inspect -- --document <id>
pnpm corpus:publish -- --document <id> --fake-embedder
pnpm corpus:reindex -- --fake-embedder
pnpm corpus:retire -- --document <id> --reason "superseded"
```

`--fake-embedder` uses hash-derived vectors (CI and machines without Ollama). Omit it to embed with the configured Ollama model. The API must use the same embedder: set `FAKE_MODELS=true` in `.env` when the corpus was published with `--fake-embedder`, otherwise `/ask` retrieves no passages.

```bash
pnpm eval:retrieval   # recall@5; generation metrics require a live Ollama run without --fake-embedder
pnpm bench:ask        # stage timings against local Ollama; not CI-gated
```

Regenerate the fixture PDFs with `node data/generate-synthetic-pdfs.mjs`.

### Local models

Ollama is not started by `pnpm infra:up`. Pull models only when you need live embeddings or generation:

```bash
docker compose --profile models up -d
```

Confirm the chat tag with `ollama list`. Model identity is stored as a digest, not a tag.

### Query log retention

`AnswerLog` stores the query text, retrieval identifiers, model tags/digests, prompt/policy/retrieval/chunking versions, corpus revision, and stage timings. It does not store IP addresses or user agents. Rows older than `QUERY_LOG_RETENTION_DAYS` (default 30) are deleted by a daily worker job.
