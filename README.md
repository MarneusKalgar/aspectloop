# Elemika Correction MVP

A local-first monorepo for reviewing, correcting, and eventually submitting structured data extracted from supplier documents.

The current repository contains a completed Phase 0 scaffold:

- NestJS API scaffold in `apps/api`
- React + Vite frontend shell in `apps/web`
- Local Docker Compose backend dependency stack
- PostgreSQL and RabbitMQ local dependencies
- Health-only persistence-service mock

## Features

- Plain npm workspaces monorepo
- Node 24 / npm 11.6.1 pinned at the repository root
- Nest CLI based API scaffold
- Runtime env validation with `class-validator`
- Pino logger integration
- TypeORM bootstrap and CLI `DataSource`
- Extracted CORS setup and `/health` endpoint
- React Router + Material UI frontend shell
- Backend Docker Compose stack for API, PostgreSQL, RabbitMQ, and persistence mock
- Husky, lint-staged, ESLint, and Prettier root tooling

## Technology Stack

### Backend

- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- RabbitMQ
- nestjs-pino
- Docker / Docker Compose

### Frontend

- React 19
- Vite
- React Router
- Material UI

### Tooling

- npm workspaces
- ESLint
- Prettier
- Husky
- lint-staged

## Prerequisites

Required:

- Node.js 24.x
- npm 11.6.x
- Git

Optional for backend local stack:

- Docker Desktop or Docker Engine
- Docker Compose v2

## Installation

```bash
git clone <repository-url>
cd elemika
npm install
```

The repository already contains app-local env templates and local development env files:

- `apps/api/.env.example`
- `apps/api/.env.local`
- `apps/web/.env.example`
- `apps/web/.env.local`

Review and adjust them if your local ports or credentials differ.

## Environment Configuration

### API

Primary file:

- `apps/api/.env.local`

Key variables:

```bash
NODE_ENV=development
API_PORT=8080
CORS_ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=postgresql://elemika:elemika@postgres:5432/elemika
RABBITMQ_HOST=rabbitmq
PERSISTENCE_MOCK_PORT=8090
```

### Web

Primary file:

- `apps/web/.env.local`

Key variables:

```bash
WEB_PORT=5173
VITE_API_URL=http://localhost:8080
VITE_APP_NAME=Elemika Correction
```

## Running the Application

### Backend Docker stack

From `apps/api`:

```bash
npm run docker:build:local
npm run docker:migrate:local
npm run docker:seed:local
```

To start an already-built stack:

```bash
npm run docker:start:local
```

To stop and clean up:

```bash
npm run docker:down:local
```

### API directly

If PostgreSQL, RabbitMQ, and the persistence mock are already available, the API can be started directly:

```bash
cd apps/api
npm run dev
```

### Web directly

```bash
cd apps/web
npm run dev
```

### Builds

```bash
cd apps/api && npm run build
cd apps/web && npm run build
```

## Docker Support

The local backend stack is defined in `apps/api/compose.local.yml`.

Services included:

- `api`
- `postgres`
- `rabbitmq`
- `persistence-mock`
- `migrate` (profiled one-off container)
- `seed` (profiled one-off container)

Docker development images currently use:

- `apps/api/Dockerfile.dev`
- `mocks/persistence-service/Dockerfile.dev`

The compose stack uses `apps/api/.env.local` as its primary env source.

## Available Local Endpoints

| Service          | Endpoint                       | Description                      |
| ---------------- | ------------------------------ | -------------------------------- |
| API              | `http://localhost:8080/health` | API health endpoint              |
| Persistence mock | `http://localhost:8090/health` | Persistence mock health endpoint |
| Web              | `http://localhost:5173/`       | Frontend shell                   |

## Project Structure

```text
apps/
  api/
  web/
docs/
  general-plan.md
  phase-0-project-setup-plan.md
  phase-1-backend-foundation-plan.md
  requirements-raw.md
mocks/
  persistence-service/
package.json
package-lock.json
tsconfig.base.json
```

## Planning Docs

- `docs/general-plan.md`
- `docs/phase-0-project-setup-plan.md`
- `docs/phase-1-backend-foundation-plan.md`
- `docs/requirements-raw.md`

## Current Status

Phase 0 is complete.

The next planned implementation step is Phase 1 backend foundation:

- Schema-first GraphQL
- Document registry
- Persistence boundary
- RabbitMQ wrapper
- Auth guard skeleton
- First real migration if entity scope is agreed

See `docs/phase-1-backend-foundation-plan.md` for the detailed breakdown.
