# Initial Development Setup Plan

## Football VAR Decision Explorer (Football RAG)

| Field          | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Document       | Initial repository and development-environment setup plan              |
| Status         | Completed                                                              |
| Date           | 18 August 2026                                                         |
| Repository     | `mmichalt/var-rag`                                                     |
| Primary inputs | `AGENTS.md`, `docs/Football_VAR_RAG_Requirements_v0.1.md`              |
| Scope          | Development foundation only; no product/RAG feature implementation yet |

Local quality gates (`pnpm format:check`, `lint`, `typecheck`, `test`, `build`) passed during implementation. Docker was not available in the WSL environment, so Compose health, live migrations, image builds, and `docker compose --profile app` were not executed locally. CI is configured to run those checks.

## 1. Objective

Create a reproducible monorepo foundation that is ready for implementation of the Football VAR RAG MVP.

The setup must provide:

- a Next.js web application;
- a NestJS HTTP API;
- a separate NestJS worker process for ingestion/indexing/background jobs;
- PostgreSQL with `pgvector`;
- Redis for BullMQ jobs;
- optional local S3-compatible object storage for raw source documents;
- database migrations;
- environment validation;
- health/readiness endpoints;
- structured logging and correlation IDs;
- local Docker infrastructure;
- production-capable application Dockerfiles;
- linting, formatting, testing, and CI;
- concise developer documentation and repeatable commands.

This milestone should establish infrastructure and boundaries only. It must not implement football incident ingestion, retrieval, embeddings, generation, admin workflows, or user-facing product features.

---

## 2. Architecture decisions

### 2.1 Use Nx

Use **Nx** for the monorepo.

Rationale:

- there will be at least three independently deployable Node applications (`web`, `api`, `worker`);
- API and worker will share database/configuration code;
- Nx provides project boundaries, dependency graphing, task orchestration, caching, generators, and affected builds without introducing a runtime dependency;
- Nx has first-party support for both Next.js and NestJS;
- it gives Cursor/Codex a discoverable project graph instead of a collection of loosely related packages.

Do **not** enable Nx Cloud in this milestone. Local Nx caching is sufficient.

Because the repository already contains `AGENTS.md`, `.cursor/`, `.gitignore`, and `docs/`, initialize Nx **inside the existing repository**. Do not scaffold a separate repository and do not overwrite existing files.

### 2.2 Package manager and runtime

Use:

- **Node.js 24 LTS**
- **pnpm**, managed through Corepack
- the latest stable Nx release compatible with the generated Next.js/NestJS versions
- TypeScript in strict mode

Pin the exact package-manager version in the root `package.json` `packageManager` field and commit `pnpm-lock.yaml`.

Do not use globally installed project dependencies as part of the documented workflow.

### 2.3 Applications

Create exactly these deployable applications:

```text
apps/
  web/       # Next.js App Router application
  api/       # NestJS HTTP API
  worker/    # NestJS standalone/background worker
```

Responsibilities:

#### `web`

- Next.js App Router;
- TypeScript;
- Tailwind CSS for basic styling infrastructure only;
- no component library yet;
- no database access;
- communicates with the Nest API rather than accessing persistence directly.

#### `api`

- NestJS HTTP application;
- REST/JSON API;
- OpenAPI/Swagger documentation;
- request validation;
- health/readiness endpoints;
- database and Redis connectivity;
- future producer of background jobs.

#### `worker`

- NestJS standalone application created with `NestFactory.createApplicationContext`;
- no HTTP listener;
- Redis/BullMQ connectivity;
- future owner of ingestion, parsing, chunking, embedding, indexing, and rebuild jobs.

The API must not perform expensive ingestion/indexing work synchronously.

### 2.4 Shared libraries

Create only shared libraries that are immediately used.

Initial libraries:

```text
libs/
  config/       # backend environment schema/config shared by api + worker
  database/     # TypeORM data source, Nest DB module, migrations
```

Do **not** create speculative libraries such as `common`, `core`, `utils`, `rag`, `domain`, `retrieval`, `llm`, `providers`, or `contracts` until a concrete feature requires them.

### 2.5 Persistence and infrastructure

Use the following MVP infrastructure:

| Need                     | Technology                         | Reason                                                                   |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------ |
| Primary relational store | PostgreSQL                         | incidents, laws, source metadata, audit data, filters                    |
| Vector search            | `pgvector`                         | keeps vectors with relational metadata and avoids a second database      |
| Lexical search           | PostgreSQL full-text search        | sufficient for MVP hybrid retrieval; no search cluster initially         |
| Background jobs          | Redis + BullMQ                     | restartable/distributed ingestion and indexing jobs                      |
| Raw source objects       | MinIO, local-only/optional profile | S3-compatible storage for supplied source files when that feature begins |

Do **not** add:

- Elasticsearch/OpenSearch;
- Pinecone;
- Weaviate;
- Qdrant;
- Kafka;
- RabbitMQ;
- Kubernetes;
- a service mesh;
- a separate auth service;
- LangChain or LlamaIndex.

Those require a concrete need before adoption.

### 2.6 ORM

Use **TypeORM** with the PostgreSQL driver.

Requirements:

- `synchronize: false` in every environment;
- all schema changes through migrations;
- use TypeORM's PostgreSQL `vector` support when embedding columns are introduced;
- raw SQL is allowed where PostgreSQL vector/full-text operators are clearer than ORM abstractions;
- database access belongs in backend projects only.

---

## 3. Target repository structure

The implementation should result in approximately this structure:

```text
.
├── .cursor/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── api/
│   │   └── src/
│   ├── web/
│   │   └── src/
│   └── worker/
│       └── src/
├── docker/
│   ├── api.Dockerfile
│   ├── web.Dockerfile
│   └── worker.Dockerfile
├── docs/
│   ├── Football_VAR_RAG_Requirements_v0.1.md
│   └── initial_setup.md
├── libs/
│   ├── config/
│   │   └── src/
│   └── database/
│       └── src/
│           ├── migrations/
│           ├── data-source.ts
│           └── ...
├── .dockerignore
├── .env.example
├── .gitignore
├── .nvmrc
├── AGENTS.md
├── compose.yaml
├── eslint.config.*
├── nx.json
├── package.json
├── pnpm-lock.yaml
├── README.md
└── tsconfig.base.json
```

Allow Nx generators to create additional required configuration files. Do not reorganize generated files merely for aesthetics.

---

## 4. Implementation sequence

Implement in the following order. Finish and validate each phase before moving to the next.

### Phase 1 — Runtime and workspace bootstrap

1. Preserve all current repository files.
2. Add `.nvmrc` containing Node major `24`.
3. Create the root `package.json` using pnpm.
4. Enable Corepack and pin pnpm in `package.json`.
5. Initialize Nx in the existing repository.
6. Do not enable Nx Cloud.
7. Add Nx plugins using `nx add` so all Nx package versions stay aligned:
   - `@nx/next`
   - `@nx/nest`
   - other first-party Nx plugins only where required by generated projects/tests.
8. Configure strict TypeScript defaults.
9. Merge generated ignore rules into the existing `.gitignore`; never replace the current file wholesale.
10. Verify:
    - `pnpm nx report`
    - `pnpm nx show projects`
    - `pnpm nx graph` can resolve the workspace.

Before running a generator, inspect its current help output rather than guessing obsolete generator flags.

### Phase 2 — Generate applications

#### Web

Generate `apps/web` using `@nx/next`.

Required choices:

- Next.js App Router;
- TypeScript;
- ESLint;
- Tailwind CSS;
- no custom Node/Express server;
- no Pages Router;
- no example/demo application beyond one minimal landing/status page.

The initial page should contain only a simple project title and development status. Do not design the real product UI yet.

#### API

Generate `apps/api` using `@nx/nest`.

Then:

- remove generated demo endpoints that have no ongoing purpose;
- configure global prefix `/api`;
- enable URI API versioning with initial version `v1`;
- listen on configurable `API_PORT`, default `3001` in development;
- enable graceful shutdown hooks.

Expected health routes:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

#### Worker

Generate `apps/worker` using `@nx/nest`, but convert bootstrap to a standalone Nest application context:

```text
NestFactory.createApplicationContext(...)
```

It must not bind an HTTP port.

It should:

- load validated backend configuration;
- initialize database connectivity;
- initialize BullMQ/Redis connectivity;
- log successful startup;
- shut down cleanly on termination.

Do not add fake ingestion processors merely to make the worker look populated.

### Phase 3 — Nx boundaries

Assign project tags so dependency direction can be enforced.

Suggested tags:

```text
web       -> type:app, scope:web
api       -> type:app, scope:backend
worker    -> type:app, scope:backend
config    -> type:lib, scope:backend
database  -> type:lib, scope:backend
```

Configure Nx/ESLint module-boundary rules so:

- `web` cannot import `api`, `worker`, `database`, or backend-only config;
- `api` cannot import application code from `worker`;
- `worker` cannot import application code from `api`;
- backend apps may import backend libraries;
- libraries may not import applications.

Do not add a complicated layered taxonomy until real domain libraries exist.

---

## 5. Environment and configuration

Create a committed `.env.example`. Do not commit `.env`.

The development configuration should include at minimum:

```dotenv
NODE_ENV=development

WEB_PORT=3000
API_PORT=3001

DATABASE_URL=postgresql://football_rag:football_rag_dev@localhost:5432/football_rag
REDIS_URL=redis://localhost:6379

CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=debug

# Optional until object-storage ingestion is implemented
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=football_rag
S3_SECRET_KEY=football_rag_dev
S3_BUCKET=football-rag-sources
S3_FORCE_PATH_STYLE=true

# Future RAG provider settings — document names now, do not require them at startup yet.
# LLM_PROVIDER=
# LLM_MODEL=
# EMBEDDING_PROVIDER=
# EMBEDDING_MODEL=
# EMBEDDING_DIMENSIONS=
```

### Backend validation

Implement `libs/config` using a small explicit schema validator, preferably Zod.

Rules:

- `api` and `worker` must validate required environment variables during startup;
- invalid configuration must fail fast with a useful error;
- do not silently default secrets;
- optional future RAG variables must not be required yet;
- `NODE_ENV`, URLs, ports, CORS origins, and log level must be typed after validation.

### Frontend environment

Keep frontend environment handling separate from backend config so server secrets can never be bundled into the browser.

Add only values actually used by the web application.

If a public API URL is needed:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
```

---

## 6. PostgreSQL and TypeORM

### 6.1 Database library

`libs/database` should own:

- TypeORM `DataSource`;
- Nest database module/configuration shared by `api` and `worker`;
- migrations;
- database-specific configuration;
- future entities when they are introduced.

The library must not depend on either app.

### 6.2 Initial migration

Create an initial migration that enables `pgvector`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Do not create incident, law, chunk, user, audit, or source tables in this setup milestone. Those belong to data-model/design implementation.

### 6.3 Migration rules

- `synchronize` must always remain `false`;
- migrations must be runnable from the repository root;
- migrations must be runnable in CI;
- migration commands must use the same data-source configuration as the applications;
- production containers must not depend on TypeScript source paths that do not exist after build;
- database migration failure must stop deployment/startup orchestration rather than being ignored.

Add root scripts with clear names. Exact TypeORM CLI syntax may depend on the generated module format; inspect and verify it during implementation.

Required developer capabilities:

```text
pnpm db:migrate
pnpm db:migration:create -- <name>
pnpm db:migration:generate -- <name>
pnpm db:migration:revert
```

Document the final verified syntax in `README.md`.

---

## 7. Redis and BullMQ

Use:

- Redis Open Source;
- BullMQ;
- Nest's `@nestjs/bullmq` integration.

Configure the Redis connection from `REDIS_URL`.

Both API and worker may establish BullMQ infrastructure, but only the worker should execute expensive ingestion/indexing processors.

At this milestone:

- verify Redis connectivity;
- configure BullMQ root connection;
- do not invent a queue hierarchy;
- create queue names only when a concrete first ingestion job is implemented.

Redis should use persistence in local Docker development because queued jobs must survive ordinary container restarts.

---

## 8. Docker Compose

Create one root `compose.yaml`.

### Default services

Running:

```bash
docker compose up -d
```

should start only development infrastructure required by normal coding:

- `postgres`
- `redis`

### PostgreSQL service

Use the official `pgvector/pgvector` image with a **pinned stable version**, not `latest`.

Requirements:

- persistent named volume;
- development-only credentials from Compose environment/defaults;
- port `5432`;
- `pg_isready` healthcheck;
- database name `football_rag`;
- enough shared memory for later vector index creation where practical.

The `vector` extension should be enabled through the application migration, not by hiding schema changes in an undocumented container init script.

### Redis service

Use a pinned stable Redis image.

Requirements:

- persistent named volume;
- port `6379`;
- append-only persistence enabled for local job durability;
- healthcheck using `redis-cli ping`.

### Optional MinIO service

Add MinIO under a Compose profile such as:

```text
object-storage
```

It should not start during ordinary `docker compose up -d` until object-storage-backed ingestion is needed.

When enabled, provide:

- API port `9000`;
- console port `9001`;
- persistent named volume;
- development-only credentials;
- documented bucket bootstrap approach.

Do not wire application startup to MinIO yet.

### Optional application profile

Add `web`, `api`, and `worker` under a Compose profile such as:

```text
app
```

This provides a full-container smoke environment without forcing developers to run applications in containers during normal HMR development.

Expected command:

```bash
docker compose --profile app up --build
```

The full stack should use container-internal service URLs:

```text
postgres:5432
redis:6379
api:3001
```

Use Compose healthchecks and `depends_on` health conditions where they add real startup correctness.

---

## 9. Application Dockerfiles

Create:

```text
docker/web.Dockerfile
docker/api.Dockerfile
docker/worker.Dockerfile
```

Requirements:

- multi-stage builds;
- Node 24 base image;
- pnpm/Corepack;
- install from lockfile;
- build through Nx targets;
- production runtime stages contain only required runtime output/dependencies;
- run as a non-root user where practical;
- do not bake `.env` or secrets into images;
- `.dockerignore` excludes `.git`, `.nx/cache`, `node_modules`, coverage, local data, secrets, and editor state;
- Next.js production image should use a production-oriented output strategy compatible with the generated Nx/Next configuration;
- API and worker images must start built JavaScript, not `ts-node`.

Verify all three images build successfully.

---

## 10. API baseline

Configure the Nest API with:

### Required

- `/api` global prefix;
- URI version `v1`;
- global validation pipe:
  - transform enabled;
  - whitelist enabled;
  - reject unknown/non-whitelisted fields where appropriate;
- Helmet;
- explicit CORS allowlist from configuration;
- graceful shutdown hooks;
- OpenAPI/Swagger generation;
- structured JSON logging outside human-friendly local mode, or JSON in all environments if simpler;
- incoming request correlation ID support.

### OpenAPI

Expose Swagger UI in development at:

```text
/api/docs
```

Also make the OpenAPI JSON obtainable for future contract testing/type generation.

Production exposure should be configurable; do not assume public Swagger is always desirable.

### Health semantics

`/health/live`:

- checks that the API process is running;
- must not fail merely because PostgreSQL/Redis is temporarily unavailable.

`/health/ready`:

- checks PostgreSQL;
- checks Redis;
- returns non-success while mandatory dependencies are unavailable.

Use Nest Terminus where it reduces custom health-check code.

---

## 11. Logging and correlation

The requirements call for query/job correlation and structured logs.

Initial implementation should provide the foundation without introducing a full observability platform.

### API

- accept an incoming `x-request-id` when valid, otherwise generate one;
- return the request ID in the response header;
- log request method, path, status, duration, and request ID;
- never log authorization tokens, cookies, full request bodies, secrets, or raw source content by default.

### Worker

Every future job log must be able to include:

- BullMQ job ID;
- queue name;
- job name;
- future ingestion/source ID where available.

At this setup milestone, log process startup/shutdown and dependency initialization.

### Deferred

Do not install a metrics backend, tracing backend, ELK stack, or Grafana stack now.

OpenTelemetry instrumentation may be added when the first real ingestion/query pipeline exists, at which point there are meaningful spans to trace.

---

## 12. Frontend baseline

The web app should be intentionally small.

Required:

- Next.js App Router;
- strict TypeScript;
- Tailwind configured;
- accessible semantic HTML;
- no database import;
- no backend secrets;
- no authentication UI yet;
- no RAG/search UI yet;
- no design system/component-library dependency yet.

The root page may show:

- `Football VAR Decision Explorer`;
- a small development status message;
- optionally an API readiness indicator if it can fail gracefully.

Do not spend this milestone designing the actual interface.

---

## 13. Testing baseline

Use the testing tools generated/recommended by the Nx plugins where practical rather than replacing them immediately.

At minimum, implement:

### Configuration tests

- valid backend development config passes;
- missing `DATABASE_URL` fails;
- malformed `REDIS_URL` fails.

### API tests

- liveness endpoint returns success;
- readiness endpoint succeeds when PostgreSQL and Redis are available;
- validation rejects unexpected payload fields on a small test DTO/route only if such a route naturally exists; do not create fake business endpoints just for this;
- request ID is returned/preserved.

### Database integration check

With the Compose PostgreSQL running:

- migrations apply successfully;
- `SELECT extname FROM pg_extension WHERE extname = 'vector'` confirms `vector`;
- migration rerun is safe;
- revert behavior is understood/documented for the initial migration.

### Web test

- initial page renders successfully.

### Worker smoke check

- worker application context starts when PostgreSQL and Redis are available;
- worker shuts down cleanly.

Do not add a broad mock framework or elaborate test harness before real product code exists.

---

## 14. Code quality

Configure:

- ESLint through Nx;
- Prettier;
- strict TypeScript;
- Nx module boundaries;
- no unused demo code;
- no committed build artifacts;
- no committed `.env`;
- no generated database/vector data in Git.

Required root-level commands:

```text
pnpm format
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm typecheck
```

If generated Nx projects use different target names, normalize the root scripts to provide these stable developer commands.

Do not add Husky/lint-staged in this milestone. CI is the enforcement boundary.

---

## 15. Developer scripts

Provide concise root scripts for the common workflow.

Expected capabilities:

```text
pnpm dev:web
pnpm dev:api
pnpm dev:worker

pnpm infra:up
pnpm infra:down
pnpm infra:logs

pnpm db:migrate
pnpm db:migration:create -- <name>
pnpm db:migration:generate -- <name>
pnpm db:migration:revert

pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

A single `pnpm dev` command that starts `web`, `api`, and `worker` is desirable if it can be implemented cleanly. Prefer Nx-native orchestration; if the generated targets make that awkward, a tiny development-only process runner such as `concurrently` is acceptable.

Do not write shell-specific scripts that break on Windows/WSL unnecessarily.

---

## 16. README

Create a root `README.md`.

Keep it operational rather than promotional.

It should include:

1. project one-paragraph description;
2. architecture summary (`web`, `api`, `worker`, PostgreSQL/pgvector, Redis);
3. prerequisites:
   - Node 24;
   - Corepack/pnpm;
   - Docker with Compose;
4. first-time setup;
5. `.env` creation from `.env.example`;
6. starting infrastructure;
7. running migrations;
8. starting each application;
9. running tests/lint/build;
10. full Docker stack command;
11. useful local URLs;
12. migration commands;
13. note that product requirements live in `docs/Football_VAR_RAG_Requirements_v0.1.md`.

Suggested local URLs:

```text
Web:         http://localhost:3000
API:         http://localhost:3001/api/v1
Swagger:     http://localhost:3001/api/docs
Liveness:    http://localhost:3001/api/v1/health/live
Readiness:   http://localhost:3001/api/v1/health/ready
MinIO UI:    http://localhost:9001   # only with object-storage profile
```

---

## 17. GitHub Actions CI

Create `.github/workflows/ci.yml`.

Run on pull requests and pushes to the default branch.

Use:

- Node 24;
- Corepack/pnpm;
- frozen lockfile;
- pnpm dependency cache where supported.

Minimum checks:

```text
format:check
lint
typecheck
test
build
docker compose config
```

Also run backend integration setup:

1. start PostgreSQL and Redis;
2. wait for healthchecks;
3. run migrations;
4. run relevant integration/e2e tests;
5. stop infrastructure even when tests fail.

Build the application Docker images in CI once the Dockerfiles exist.

For this small initial workspace, running all checks is preferable to prematurely optimizing the workflow. Nx `affected` can be introduced when CI duration becomes meaningful.

Do not enable Nx Cloud as part of this milestone.

---

## 18. Security baseline

Apply only security measures that are already relevant:

- no secrets committed;
- `.env.example` contains development placeholders only;
- production does not use development credentials;
- API uses Helmet;
- CORS uses explicit configured origins;
- request validation is enabled;
- application containers do not run as root where practical;
- Swagger production exposure is configurable;
- logs exclude secrets/tokens/raw source data;
- database schema synchronization is disabled;
- no public ingestion/admin endpoints exist yet;
- MinIO development credentials are not treated as production defaults.

Do not implement authentication until the first privileged application workflow is defined, but do not create any privileged endpoint before authentication exists.

---

## 19. RAG-specific architectural guardrails

The initial setup must leave clear places for the future pipeline without implementing it prematurely.

Future processing boundaries will be:

```text
acquisition
  -> normalization
  -> review/publication
  -> chunking
  -> embedding
  -> indexing
  -> retrieval
  -> reranking
  -> generation
  -> policy/citation validation
  -> presentation
```

The setup should make this future direction possible through the separate worker/API/database boundaries.

Do **not** yet add:

- embedding provider SDKs;
- LLM provider SDKs;
- prompt templates;
- vector indexes;
- chunk tables;
- incident/law tables;
- scraping libraries;
- PDF parsers;
- rerankers;
- agent frameworks.

Those should be introduced by requirements-driven implementation stories so model versions, chunking rules, indexes, and provenance are explicit rather than hidden inside bootstrap code.

---

## 20. What is intentionally deferred

The following are **not part of `initial_setup.md` implementation**:

- target Premier League season selection;
- end-user authentication;
- reviewer/admin authentication and RBAC;
- incident schema;
- law/protocol schema;
- source registry schema;
- source acquisition connectors;
- scraping;
- document parsing;
- review queue/workspace;
- embeddings;
- hybrid retrieval implementation;
- HNSW/IVFFlat indexes;
- answer generation;
- citation validation;
- feedback workflow;
- audit-log domain implementation;
- evaluation dataset;
- admin UI;
- production cloud provider;
- CDN;
- managed PostgreSQL/Redis/S3;
- Kubernetes;
- observability backend;
- deployment pipeline beyond build/test container validation.

Do not sneak deferred work into the bootstrap.

---

## 21. Acceptance criteria

The setup is complete only when all of the following are true.

### Workspace

- [ ] Existing `AGENTS.md`, `.cursor/`, and requirements documentation are preserved.
- [ ] pnpm install succeeds from a clean checkout.
- [ ] Nx recognizes `web`, `api`, `worker`, `config`, and `database`.
- [ ] Nx project graph contains no circular dependency.
- [ ] Module-boundary rules prevent frontend access to backend persistence code.

### Infrastructure

- [ ] `docker compose up -d` starts healthy PostgreSQL/pgvector and Redis.
- [ ] Persistent volumes are configured.
- [ ] PostgreSQL healthcheck passes.
- [ ] Redis healthcheck passes.
- [ ] Optional MinIO service is isolated behind a profile.
- [ ] `docker compose config` succeeds.

### Database

- [ ] TypeORM uses `synchronize: false`.
- [ ] Initial migration enables `vector`.
- [ ] Migration runs from a clean database.
- [ ] API and worker use the shared database configuration.

### API

- [ ] API starts on port `3001` by default.
- [ ] `/api/v1/health/live` returns success.
- [ ] `/api/v1/health/ready` checks PostgreSQL and Redis.
- [ ] Swagger UI is available in development.
- [ ] Global validation, Helmet, CORS, and shutdown hooks are enabled.
- [ ] API propagates or creates a request ID.

### Worker

- [ ] Worker starts without opening an HTTP port.
- [ ] Worker connects to Redis/BullMQ and PostgreSQL.
- [ ] Worker exits cleanly.

### Web

- [ ] Web starts on port `3000`.
- [ ] Minimal root page renders.
- [ ] Web has no direct database/backend-library dependency.
- [ ] No backend secret is exposed to browser code.

### Containers

- [ ] Web production image builds.
- [ ] API production image builds.
- [ ] Worker production image builds.
- [ ] `docker compose --profile app up --build` can start the full application stack.
- [ ] Application images do not contain `.env` or development secrets.

### Quality

- [ ] `pnpm format:check` succeeds.
- [ ] `pnpm lint` succeeds.
- [ ] `pnpm typecheck` succeeds.
- [ ] `pnpm test` succeeds.
- [ ] `pnpm build` succeeds.
- [ ] CI executes the same essential checks from a clean environment.
- [ ] README commands have been executed and corrected if necessary.

---

## 22. Requirements traceability for this milestone

This setup directly supports the existing SRS, especially:

| Requirement | Setup contribution                                                                |
| ----------- | --------------------------------------------------------------------------------- |
| FR-003      | persistence foundation for provenance/raw-source lineage                          |
| FR-044      | PostgreSQL + rebuildable vector-index architecture; no opaque external-only store |
| NFR-010     | background-worker/queue foundation for incremental ingestion                      |
| NFR-012     | durable queued-job architecture                                                   |
| NFR-017     | API validation, Helmet, explicit CORS, secret handling                            |
| NFR-018     | structured logging rules exclude secrets/unnecessary data                         |
| NFR-026     | explicit web/API/worker and shared-library boundaries                             |
| NFR-027     | Docker Compose and production-capable Dockerfiles                                 |
| NFR-028     | configuration foundation; model-specific packages deferred until used             |
| NFR-029     | structured logs and request/job correlation foundation                            |
| NFR-030     | automated tests and CI quality gates                                              |

This milestone does not claim full compliance with those requirements; it creates the engineering foundation needed to implement and verify them later.

---

## 23. Agent implementation rules

When Cursor, Codex, or another coding agent implements this document:

1. Read `AGENTS.md` first.
2. Read `docs/Football_VAR_RAG_Requirements_v0.1.md`.
3. Inspect the repository before changing files.
4. Use current generator help/documentation instead of assuming CLI flags.
5. Prefer Nx generators and official framework integrations.
6. Pin dependencies through pnpm and commit the lockfile.
7. Do not add architecture not requested by this plan.
8. Do not implement product features.
9. Do not commit, push, or create a PR unless explicitly requested.
10. Run every documented validation command and report actual observed failures rather than claiming success.
11. If generated defaults conflict with this plan, choose the smallest change that satisfies this plan and document the reason.
12. Before finishing, remove unused generated demo code and unnecessary dependencies.
13. Update `README.md` with the commands that actually work after implementation.

---

## 24. Suggested Cursor/Codex handoff prompt

```text
Implement docs/initial_setup.md.

Before changing anything, read AGENTS.md and
docs/Football_VAR_RAG_Requirements_v0.1.md, then inspect the current repository.

Follow initial_setup.md as the implementation contract. Use Nx generators and
official integrations where possible, but inspect current CLI help before using
generator flags. Preserve the existing docs, .cursor configuration, AGENTS.md,
and gitignore rules.

Keep this strictly to the development foundation: Nx/pnpm workspace, Next.js
web app, NestJS API, standalone NestJS worker, PostgreSQL+pgvector, Redis/BullMQ,
optional MinIO Compose profile, TypeORM migrations, config validation, Docker,
health checks, baseline security/logging, tests, CI, and README.

Do not add football domain tables, ingestion logic, LLM/embedding SDKs,
LangChain/LlamaIndex, authentication, RAG logic, or product UI.

Run and report the acceptance checks from initial_setup.md. Do not commit or
push changes.
```
