# AspectLoop

AspectLoop is a local-first workspace for reviewing, correcting, and eventually
submitting structured data extracted from supplier documents.

AspectLoop is an independent learning and portfolio project and is not
affiliated with or endorsed by Elemica.

The M01 repository-boundary refactor, M01.1 GraphQL remediation, M02 product
rebrand, and M03-A toolchain and dependency-security foundation are complete.
M03-B adds deterministic verification and pull-request gates next.
The existing product behavior remains in the gateway while the extraction and
correction runtimes are independent health-only NestJS shells.

## Application Boundaries

- `@aspectloop/web`: React and Vite browser application.
- `@aspectloop/gateway-api`: public schema-first GraphQL API, authentication, and
  the current temporary home for correction behavior.
- `@aspectloop/extraction-service`: extraction runtime shell; no extraction
  behavior or infrastructure dependency exists yet.
- `@aspectloop/correction-service`: correction runtime shell; correction behavior
  remains in the gateway until M06.
- `@aspectloop/contracts`: framework-free public boundary for contracts that are
  genuinely shared by independent runtimes.
- `@aspectloop/persistence-service-mock`: local file-backed persistence dependency.

## Prerequisites

- Node.js `24.19.0`
- npm `12.0.2` installed independently for that Node version
- Docker Desktop or Docker Engine with Docker Compose v2 for the local backend
  stack

Node `24.19.0` bundles npm `11.17.0`, while AspectLoop intentionally pins npm
`12.0.2`. Select the repository Node version before invoking npm:

```bash
nvm use
node --version
npm --version
npm ci
```

Expected versions are `v24.19.0` and `12.0.2`. `npm ci` is the normal clean,
lockfile-based installation command. Dependency changes remain human-owned and
use reviewed npm uninstall/install commands rather than manifest edits.

## Dependency Security

The repository enforces a three-day package release quarantine, registry-only
dependency sources, and explicit lifecycle-script review. The canonical policy,
human approval workflow, audit commands, and emergency exception process are in
`docs/dependency-security.md`.

Read-only repository checks are available from the root:

```bash
npm run deps:policy
npm run deps:scripts:pending
npm run deps:audit
npm run deps:signatures
```

`npm audit signatures` checks registry signatures and supported provenance
attestations. It does not replace vulnerability review. Never use
`npm audit fix --force`, `--legacy-peer-deps`, or a blanket install-script
approval.

If npm reports the machine-local legacy `python` configuration, remove it from
the user npm configuration outside this repository before running npm with the
project's strict configuration policy.

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
npm run graphql-codegen --workspace @aspectloop/web
```

## GraphQL Transport And Code Generation

The gateway is a NestJS application on Express that serves schema-first
GraphQL through GraphQL Yoga. Apollo Client remains the browser GraphQL client.

GraphiQL and GraphQL introspection are available only in local development and
test environments at `http://localhost:8080/graphql`. Stage and production
expose neither capability.

Normal local code generation reads gateway-owned SDL from
`apps/gateway-api/src/graphql/schema` without starting the gateway. Set
`GQL_SCHEMA_URL` in `apps/web/.env.local` only when generating against a
running local, stage, or future Java backend. Generated web artifacts are owned
by `apps/web/src/graphql/generated`; handwritten hooks, runtime configuration,
and utilities remain outside that directory.

Browser MSW is a development and test capability. Set
`VITE_MOCK_GQL_RUNTIME=true` only for the Vite development server or mocked
browser workflow. Production Vite builds force mock mode off and exclude the
MSW worker, browser runtime, handlers, fixtures, and mock credential hint.

## Local Endpoints

| Service          | Endpoint                        | Description                                            |
| ---------------- | ------------------------------- | ------------------------------------------------------ |
| Gateway          | `http://localhost:8080/health`  | Gateway health endpoint                                |
| GraphiQL         | `http://localhost:8080/graphql` | Local GraphQL IDE; unavailable in stage and production |
| Persistence mock | `http://localhost:8090/health`  | File-backed persistence mock health endpoint           |
| Web              | `http://localhost:5173/`        | Browser application                                    |
| Extraction shell | `http://localhost:8081/health`  | Independent extraction runtime identity                |
| Correction shell | `http://localhost:8082/health`  | Independent correction runtime identity                |

GraphiQL is served at the same `/graphql` path as the gateway in local
development and test environments. Add an
`Authorization: Bearer <token>` request header for protected operations. Do
not save real tokens in committed queries or browser history.

## Local Infrastructure

`infra/local/compose.local.yml` owns the current shared backend stack:

- `gateway-api`
- `postgres`
- `rabbitmq`
- `persistence-mock`
- `migrate` and `seed` profiled one-off services

Extraction and correction shells are intentionally not Compose services yet.

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

M03-A is complete. The repository now has an explicit Node/npm contract,
reviewed install-script policy, registry-source checks, a reproducible clean
install, and a zero-vulnerability audit baseline. M03-B is the next executable
milestone and owns deterministic verification and pull-request gates. See
`docs/general-plan.md`, `docs/branch-governance.md`, and
`docs/dependency-security.md` for the active boundaries.
