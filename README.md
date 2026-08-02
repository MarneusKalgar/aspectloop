# Elemika Correction MVP

Elemika is a local-first workspace for reviewing, correcting, and eventually
submitting structured data extracted from supplier documents.

The repository is in M01, the monorepo-boundary refactor. The existing product
behavior remains in the gateway while the future extraction and correction
runtimes are introduced as independent health-only NestJS shells.

## Application Boundaries

- `@elemika/web`: React and Vite browser application.
- `@elemika/gateway-api`: public schema-first GraphQL API, authentication, and
  the current temporary home for correction behavior.
- `@elemika/extraction-service`: extraction runtime shell; no extraction
  behavior or infrastructure dependency exists yet.
- `@elemika/correction-service`: correction runtime shell; correction behavior
  remains in the gateway until M06.
- `@elemika/contracts`: framework-free public boundary for contracts that are
  genuinely shared by independent runtimes.
- `@elemika/persistence-service-mock`: local file-backed persistence dependency.

## Prerequisites

- Node.js `24.x`
- npm `11.14.x`
- Docker Desktop or Docker Engine with Docker Compose v2 for the local backend
  stack

Install workspace dependencies from the repository root:

```bash
npm install
```

## Environment Files

The gateway and web applications use ignored `.env.local` files. Copy and adapt
the corresponding templates for a new checkout:

- `apps/gateway-api/.env.example`
- `apps/web/.env.example`
- `apps/extraction-service/.env.example`
- `apps/correction-service/.env.example`

The gateway template supplies database, RabbitMQ, persistence-mock, JWT, CORS,
and GraphQL introspection configuration. The service shells need only their
port and optional log level.

## Local Development

Run an application directly from the repository root:

```bash
npm run dev:web
npm run dev:gateway
npm run dev:extraction
npm run dev:correction
```

The gateway requires PostgreSQL, RabbitMQ, and the persistence mock. Start
those dependencies, together with the gateway, through the local Compose stack:

```bash
npm run local:up
npm run local:migrate -- --build
npm run local:seed -- --build
```

Start an already-built stack with `npm run local:start`. Stop containers while
preserving data volumes with `npm run local:down`. `npm run local:reset` also
deletes local volumes and is intentionally explicit.

Generate a future gateway migration only through the human-owned wrapper:

```bash
npm run local:db:generate:gateway -- <migration-name>
```

M01 changes no schema and therefore creates no migration.

## Build And GraphQL Commands

```bash
npm run build
npm run build:web
npm run build:gateway
npm run build:extraction
npm run build:correction
npm run build:contracts
npm run graphql-codegen --workspace @elemika/web
```

## Local Endpoints

| Service          | Endpoint                        | Description                                            |
| ---------------- | ------------------------------- | ------------------------------------------------------ |
| Gateway          | `http://localhost:8080/health`  | Gateway health endpoint                                |
| GraphiQL         | `http://localhost:8080/graphql` | Local GraphQL IDE; unavailable in stage and production |
| Persistence mock | `http://localhost:8090/health`  | File-backed persistence mock health endpoint           |
| Web              | `http://localhost:5173/`        | Browser application                                    |
| Extraction shell | `http://localhost:8081/health`  | Independent extraction runtime identity                |
| Correction shell | `http://localhost:8082/health`  | Independent correction runtime identity                |

GraphiQL is served at the same `/graphql` path as the gateway. Add an
`Authorization: Bearer <token>` request header for protected operations. Do
not save real tokens in committed queries or browser history.

## Local Infrastructure

`infra/local/compose.local.yml` owns the current shared backend stack:

- `gateway-api`
- `postgres`
- `rabbitmq`
- `persistence-mock`
- `migrate` and `seed` profiled one-off services

The Compose project name and existing named volume keys remain compatible with
the prior local stack. Extraction and correction shells are intentionally not
Compose services yet.

## Repository Layout

```text
apps/
  web/
  gateway-api/
  extraction-service/
  correction-service/
infra/
  local/
mocks/
  persistence-service/
packages/
  contracts/
docs/
  general-plan.md
  agent-model-conventions.md
```

## Planning Status

`docs/general-plan.md` is the canonical architecture and milestone roadmap.
`AGENTS.md` and `docs/agent-model-conventions.md` define the execution and
human-verification conventions.

M01 is implemented but not yet human-verified. The required human checks cover
the regenerated npm lockfile, formatting, lint, type checks, builds, tests,
Docker Compose, migrations, code generation, and endpoint smoke checks. M02
performs the product rebrand only after those checks pass.
