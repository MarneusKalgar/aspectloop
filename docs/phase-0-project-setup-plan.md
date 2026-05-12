# Phase 0 Project Setup Completion

## Status

Phase 0 can now be treated as complete.

The current repository state satisfies the Phase 0 objective:

- `apps/api` starts locally.
- `apps/web` starts locally.
- The backend dependency stack is defined through Docker Compose.
- The persistence mock launches as a separate container.
- Local database CLI and seed entrypoints exist.

This completion state is based on the current repository structure plus the confirmed local runs of the API and web applications.

## Actual Scope Delivered

Phase 0 ended up slightly different from the first draft. The repository now uses:

- Plain npm workspaces instead of Turborepo.
- App-local env files under `apps/api` and `apps/web` instead of a single root env file.
- `Dockerfile.dev` naming for local development images.
- Nest CLI for the API scaffold.
- Root scripts only for shared formatting/linting concerns.
- Workspace-specific scripts for app dev/build/database/Docker flows.

## Current Workspace Layout

```text
.
├── apps
│   ├── api
│   │   ├── .env.example
│   │   ├── .env.local
│   │   ├── Dockerfile.dev
│   │   ├── compose.local.yml
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   ├── scripts
│   │   │   └── docker
│   │   │       ├── _local-compose-common.sh
│   │   │       ├── local-compose.sh
│   │   │       ├── local-migrate.sh
│   │   │       └── local-seed.sh
│   │   ├── src
│   │   │   ├── app.module.ts
│   │   │   ├── config
│   │   │   ├── core
│   │   │   ├── data-source.ts
│   │   │   ├── db
│   │   │   │   ├── migrations
│   │   │   │   └── seed
│   │   │   ├── health
│   │   │   └── main.ts
│   │   ├── tsconfig.app.json
│   │   └── tsconfig.json
│   └── web
│       ├── .env.example
│       ├── .env.local
│       ├── package.json
│       ├── src
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── pages
│       │   ├── router.tsx
│       │   └── vite-env.d.ts
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       └── vite.config.ts
├── docs
│   ├── general-plan.md
│   ├── phase-0-project-setup-plan.md
│   ├── requirements-raw.md
│   └── phase-1-backend-foundation-plan.md
├── mocks
│   └── persistence-service
│       ├── .dockerignore
│       ├── Dockerfile.dev
│       ├── package.json
│       └── src
│           └── server.mjs
├── .dockerignore
├── .npmrc
├── .nvmrc
├── .prettierrc
├── eslint.config.mjs
├── package-lock.json
├── package.json
└── tsconfig.base.json
```

## Delivered Backend Baseline

The API scaffold now includes:

- Nest CLI configuration.
- `ConfigModule` with runtime env validation.
- Pino logger configuration.
- TypeORM module bootstrap and standalone `DataSource` for CLI usage.
- CORS setup extracted into a dedicated helper.
- Health endpoint at `/health`.
- Local Docker Compose stack with PostgreSQL, RabbitMQ, API, and persistence mock.
- Database scripts for generate/migrate/revert/seed flows.

The persistence mock intentionally remains minimal in Phase 0:

- `GET /health` returns service health.
- All real document read/write behavior is deferred to Phase 1.

## Delivered Frontend Baseline

The web scaffold now includes:

- Vite + React 19 app shell.
- React Router setup.
- Material UI baseline layout.
- Home page and not-found page.
- App-local env files.

## Root Tooling Decisions

The root of the repository now owns only shared tooling concerns:

- `npm install` / `npm ci` at the workspace root.
- `npm run format`.
- `npm run lint` / `npm run lint:ci`.
- Husky + lint-staged.

Application runtime/build behavior belongs to the workspaces themselves:

- `apps/api` owns Nest, TypeORM, and Docker lifecycle scripts.
- `apps/web` owns Vite dev/build/preview scripts.

## Validation Summary

Phase 0 is considered complete because the following baseline is in place:

- API starts locally.
- Web starts locally.
- Docker Compose configuration renders successfully.
- Local API and persistence mock development images build successfully.
- App-local env file layout is in use.

## Intentionally Deferred

The following items are still out of scope for Phase 0:

- GraphQL module and SDL.
- Generated GraphQL TypeScript definitions.
- Auth guard implementation.
- Document registry.
- Persistence HTTP client behavior.
- Persistence mock read/write endpoints.
- RabbitMQ wrapper module.
- Real correction entities and migrations.
- Correction query/mutation flow.
- Apollo Client and correction page data fetching.

## Phase 1 Handoff

Phase 1 should start from the current API scaffold and add backend foundation work only.

See `docs/phase-1-backend-foundation-plan.md` for the detailed execution plan.
