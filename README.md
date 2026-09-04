# AspectLoop

AspectLoop is a local-first workspace for reviewing, correcting, and eventually
submitting structured data extracted from supplier documents.

AspectLoop is an independent learning and portfolio project and is not
affiliated with or endorsed by Elemica.

The M01 repository-boundary refactor, M01.1 GraphQL remediation, M02 product
rebrand, M03-A toolchain and dependency-security foundation, M03-B verification
and pull-request gates, M03-C local container hardening, and M03-D
logging/privacy baseline are complete. M03-E is evaluating advisory GitHub
review and dependency-update automation without blocking feature work.
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

The mocked browser suite uses only Playwright's Chromium project. Its canonical
test command first asks Playwright to ensure the matching headless shell is in
the local user cache:

```bash
npm run test:e2e:mock
```

Playwright's install operation is idempotent: an existing matching shell is
reused, while a missing shell is downloaded before the tests start. Run the
guard independently with
`npm run test:e2e:browser:ensure --workspace @aspectloop/web`. This
intentionally does not install Firefox, WebKit, or full headed Chromium.

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

Hosted Renovate is the only dependency-update PR bot. Eligible patch/minor
updates may open at most two weekly PRs, while majors and explicitly high-risk
platform dependencies remain behind Dependency Dashboard approval. All updates
require human review and merge authorization; automerge is disabled. The exact
policy and manual exceptions are documented in `docs/dependency-security.md`.

If npm reports the machine-local legacy `python` configuration, remove it from
the user npm configuration outside this repository before running npm with the
project's strict configuration policy.

## Deterministic Verification

Run repository checks from the root with the supported Node/npm pair:

```bash
npm run format:check
npm run lint:ci
npm run type-check
npm run graphql:check
npm run test:unit:run
npm run test:integration:run
npm run test:backend:run
npm run test:e2e:mock
npm run verify
npm run verify:full
```

The task 10.4 command baseline and the task 10.5 aggregate commands with
GraphQL drift checking were human-verified on 2026-08-16 with Node `24.19.0`,
npm `12.0.2`, and the Chromium headless shell.

`verify` is the fast merge-preparation command. It checks formatting, lint,
types, generated GraphQL drift, web unit tests, and web integration tests. The
backend lint/type commands prepare the ignored `backend-platform/dist` output
required by NestJS workspace consumers; they do not modify tracked generated
artifacts.
`verify:full` adds every workspace build, the backend logging/privacy contract
tests, and the MSW-backed Playwright suite.
The Playwright command is named `test:e2e:mock` because it runs the real Vite
UI against a mocked GraphQL backend, not the local Compose stack.

`graphql:check` generates gateway and web artifacts under the operating
system's temporary directory, normalizes line endings, and compares file sets
and content with the tracked outputs. It never invokes a write-mode generator
against tracked paths. `verify` includes this drift gate before running test
suites. Generated GraphQL directories remain excluded from ESLint and Prettier
because their generators own their format.

The pre-commit hook intentionally runs the repository type check and applies
ESLint/Prettier only to staged files through `lint-staged`. It does not run the
aggregate suites and is not a replacement for `verify` or CI.

## GitHub Pull Request Checks

`.github/workflows/pr-checks.yml` orchestrates independent `Quality`, `Mocked
Web E2E`, and path-aware `Docker Policy` jobs for pull requests to `main`.
Docker policy is isolated in `.github/workflows/reusable-docker-policy.yml`;
fixed path groups are defined under `scripts/ci/`. The stable `All Checks
Passed` aggregate is the only status intended for branch protection. The
workflow is read-only, pins actions to full commit SHAs, uses a fresh `npm ci`
per trust-isolated job, and retains Playwright failure artifacts for three
days.

The Quality job validates dependency policy before `npm ci`. Install-tree
checks remain post-install, while advisory registry-signature verification runs
last with a two-minute timeout. Docker-policy workflows and their shared change
detectors are Docker-owned paths, so policy implementation changes cannot skip
Docker validation.

Mocked web E2E runs only for web-relevant paths or an explicit manual request.
Required runs use the lockfile-matched, digest-pinned Playwright image; other
changes record an intentional skip that is validated by the aggregate gate.

Local verification, read-only AI diff review, optional specialist routing, and
human validation of AI findings are defined in `docs/review-process.md`. The
repository router is `.agents/skills/aspectloop-code-review/SKILL.md`.

The bounded backend event vocabulary, request-ID rules, environment behavior,
and prohibited fields are defined in `docs/logging-and-privacy.md`.

GitHub has registered the workflow check names. The human repository rules must
require the stable `All Checks Passed` aggregate. See
`docs/branch-governance.md` for the remaining human GitHub settings.

### Dockerfile Policy

Docker-owned pull requests run the `production` Dockerfile Roast preset before
building the development images. The action and its runtime image are pinned to
release `1.4.13`. Error-level findings block the Docker policy job; warnings
remain visible for review. The only configured rule exception is `DF012` because
the current development services define their health probes in Compose rather
than in reusable production images.

A human can run the same repository policy from the repository root without
installing another local binary:

```bash
npm run docker:policy
```

This command lints container definitions only. It does not build images, inspect
installed layers, scan image packages, or prove runtime health.

The retained `DF011` warning for the persistence mock is classified as accepted
development-image behavior: the mock has no dependency installation or build
stage, so a multi-stage Dockerfile would not reduce its runtime contents. The
warning remains visible instead of being globally suppressed because the rule
can apply to future production Dockerfiles.

### Local-Stack Human Verification

Local-stack verification is intentionally separate from deterministic
repository checks because it consumes ignored environment files and mutates
local infrastructure. Prepare the `.env.local` files and confirm that
`apps/web/.env.local` sets `VITE_MOCK_GQL_RUNTIME=false`. Then run:

```bash
npm run local:up
npm run local:migrate -- --build
npm run local:seed -- --build
curl --fail --silent --show-error http://localhost:8080/health
curl --fail --silent --show-error http://localhost:8090/health
```

In a second terminal, start the web app in live-backend mode:

```bash
npm run dev:web
```

Open `http://localhost:5173`, create a disposable local account, sign in, and
confirm that the correction inbox loads without an authorization error. Stop
the web process, then stop the backend stack while preserving its local data:

```bash
npm run local:down
```

This is the current `verify:local-stack` human flow. It is a local health and
smoke check, not the mocked browser E2E suite and not a claim of automated
full-stack coverage.

## Environment Files

The applications and local infrastructure use ignored `.env.local` files. Copy
and adapt the corresponding templates for a new checkout:

- `infra/local/.env.example`
- `apps/gateway-api/.env.example`
- `apps/web/.env.example`
- `apps/extraction-service/.env.example`
- `apps/correction-service/.env.example`

The infrastructure template supplies the local PostgreSQL administrator, three
service-owned database/role pairs, and aggregate connection budget. The gateway
template supplies only its `platform_db` connection plus RabbitMQ,
persistence-mock, JWT, CORS, and GraphQL introspection configuration. The
extraction and correction shells need only their port and optional log level
until M04-D adds their service-owned datasources.

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
npm run build --workspace @aspectloop/web
npm run build:gateway
npm run build:extraction
npm run build:correction
npm run build --workspace @aspectloop/contracts
npm run graphql:generate:gateway
npm run graphql:generate:web
npm run graphql:generate
npm run graphql:check
```

## GraphQL Transport And Code Generation

The gateway is a NestJS application on Express that serves schema-first
GraphQL through GraphQL Yoga. Apollo Client remains the browser GraphQL client.
The canonical ownership, generation, consumption, and drift model is documented
in `docs/graphql-model.md`.

GraphiQL and GraphQL introspection are available only in local development and
test environments at `http://localhost:8080/graphql`. Stage and production
expose neither capability.

Normal local code generation reads gateway-owned SDL from
`apps/gateway-api/src/graphql/schema` without starting the gateway. The
standalone gateway generator emits sorted, class-based Nest definitions to
`apps/gateway-api/src/graphql/generated/graphql.types.ts`; gateway startup no
longer rewrites that file. The web generator validates frontend operations and
emits client artifacts under `apps/web/src/graphql/generated`.

Use `npm run graphql:generate` after an SDL or frontend operation change, then
review and commit the generated diff. The canonical root generation and drift
commands force the local gateway SDL. Set `GQL_SCHEMA_URL` in
`apps/web/.env.local` only when intentionally invoking the web workspace's
`graphql-codegen` command against a running local, stage, or future Java
backend. Handwritten hooks, runtime configuration, and utilities remain outside
generated directories.

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
  knowledge-base/
    README.md
    ci-cd-for-js-ts-engineers.md
  general-plan.md
  graphql-model.md
  testing-strategy.md
  agent-model-conventions.md
```

## Planning Status

`docs/general-plan.md` is the canonical architecture and milestone roadmap.
`AGENTS.md` and `docs/agent-model-conventions.md` define the execution and
human-verification conventions. `docs/graphql-model.md` defines the public SDL,
generated-artifact, runtime-consumption, and drift-check boundaries.
`docs/knowledge-base/` contains educational mental models and is not a source
of normative architecture or governance rules.

M03-A through M03-D are complete: the repository has an explicit Node/npm and
dependency-security contract, deterministic local and pull-request gates,
scoped healthy development containers, a classified Dockerfile Roast policy,
and bounded privacy-aware logging. M03-E continues as a non-blocking Renovate
and Greptile evaluation while M04 becomes the next required implementation
milestone. See
`docs/general-plan.md`, `docs/branch-governance.md`, and
`docs/dependency-security.md` for the active boundaries.
