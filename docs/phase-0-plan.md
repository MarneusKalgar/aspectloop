# Phase 0 Local Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **For agentic workers:** Use /Users/ichernob/Desktop/learn/r_d/rd_shop as a code reference (always skip .temp and demo folders)

**Goal:** Initialize the project and make both the frontend and backend run locally with the backend dependency stack available through Docker Compose.

**Architecture:** Phase 0 is intentionally limited to workspace scaffolding and local runnability. The backend is a NestJS monolith with a health endpoint and local Docker Compose stack for PostgreSQL, RabbitMQ, and a launchable persistence-service mock. The frontend is a Vite React app with React Router and a minimal routed shell; no frontend Docker/Compose is created because the expected stage deliverable is static assets for S3 + CloudFront.

**Tech Stack:** npm workspaces, Turborepo, NestJS, TypeScript, Pino, Docker Compose for backend dependencies, Vite, React, React Router, Material UI.

- DO NOT add npm deps / dev deps directly into the package.json. list what needs to be installed as s command
- DO NOT run npm scripts
- DO NOT commit code

Execution note for this pass: scaffold creation and non-npm validation steps were completed; install- and npm-script-based verification steps remain intentionally unchecked.

---

## Scope Correction

This plan replaces the previous Phase 0 plan, which mixed setup work with later product implementation.

Phase 0 must only prove:

- The repository is initialized as an npm workspaces + Turborepo monorepo.
- `apps/api` starts locally.
- `apps/web` starts locally.
- The backend Docker Compose stack starts locally.
- Backend migration and seed scripts exist and complete successfully, even though no real schema exists yet.
- The mock persistence service starts inside Docker Compose and has only minimal health behavior.

Phase 0 must not implement:

- Shared correction contracts package.
- GraphQL SDL/resolvers/schema generation.
- Correction document query/mutation.
- Persistence HTTP client behavior.
- Real database migrations.
- Real seed data.
- Apollo Client wiring.
- Frontend auth flow.
- Correction page data fetching.
- API e2e tests for correction behavior.

## Later-Phase Mapping

The following items were moved out of Phase 0:

| Previous Item                             |    New Phase | Reason                                                         |
| ----------------------------------------- | -----------: | -------------------------------------------------------------- |
| Shared contracts package                  |      Phase 2 | Useful once correction events and backend flow contracts exist |
| Schema-first GraphQL SDL/resolvers        |      Phase 1 | Backend foundation work, not local project setup               |
| Generated GraphQL TypeScript definitions  |      Phase 1 | Depends on the real SDL contract                               |
| Correction service/resolver               |      Phase 2 | Part of backend correction flow                                |
| Real DB migration for correction sessions | Phase 1 or 2 | Schema is not designed yet                                     |
| Real seed data                            | Phase 1 or 2 | Depends on DB schema and registry decisions                    |
| Full persistence mock implementation      |      Phase 1 | Phase 0 only needs the mock container to launch                |
| Persistence HTTP client implementation    |      Phase 1 | Integration boundary belongs to backend foundation             |
| Apollo Client + GraphQL query in FE       |      Phase 3 | Frontend foundation once API contract exists                   |
| Auth provider and token wiring            |      Phase 3 | Frontend foundation                                            |
| API e2e correction tests                  | Phase 2 or 5 | Requires real correction behavior                              |

## Phase 0 File Structure

Create only this structure in Phase 0:

```text
.
├── apps
│   ├── api
│   │   ├── Dockerfile
│   │   ├── compose.local.yml
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
│   │   │   │   ├── env.schema.ts
│   │   │   │   ├── env.validation.ts
│   │   │   │   └── logger.config.ts
│   │   │   ├── db
│   │   │   │   ├── migrate.ts
│   │   │   │   └── seed.ts
│   │   │   ├── health
│   │   │   │   └── health.controller.ts
│   │   │   └── main.ts
│   │   ├── tsconfig.app.json
│   │   └── tsconfig.json
│   └── web
│       ├── index.html
│       ├── package.json
│       ├── src
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── pages
│       │   │   ├── HomePage.tsx
│       │   │   └── NotFoundPage.tsx
│       │   ├── router.tsx
│       │   └── vite-env.d.ts
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       └── vite.config.ts
├── mocks
│   └── persistence-service
│       ├── Dockerfile
│       ├── package.json
│       └── src
│           └── server.mjs
├── package.json
├── turbo.json
├── tsconfig.base.json
└── .env.example
```

## Task 1: Root Workspace

**Files:**

- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`

- [x] **Step 1: Create root `package.json`**

```json
{
  "name": "elemika",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*", "mocks/*"],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test",
    "api:docker:local": "npm --workspace apps/api run docker:local",
    "api:docker:start:local": "npm --workspace apps/api run docker:start:local",
    "api:migrate:local": "npm --workspace apps/api run docker:migrate:local",
    "api:seed:local": "npm --workspace apps/api run docker:seed:local",
    "api:down:local": "npm --workspace apps/api run docker:down:local"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "prettier": "^3.4.2",
    "turbo": "^2.5.0",
    "typescript": "^5.7.3"
  }
}
```

- [x] **Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "lint": {},
    "type-check": {},
    "test": {
      "outputs": ["coverage/**"]
    }
  }
}
```

- [x] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": false,
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [x] **Step 4: Create `.gitignore`**

```gitignore
node_modules
dist
build
coverage
.turbo
.env
.env.local
.env.development
.env.stage
```

- [x] **Step 5: Create `.env.example`**

```dotenv
NODE_ENV=development
API_PORT=8080
WEB_PORT=5173
POSTGRES_USER=elemika
POSTGRES_PASSWORD=elemika
POSTGRES_DB=elemika
DATABASE_URL=postgres://elemika:elemika@localhost:5432/elemika
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=elemika
RABBITMQ_PASSWORD=elemika
PERSISTENCE_MOCK_PORT=8090
APP_LOG_LEVEL=info
```

- [ ] **Step 6: Verify root scripts are parseable**

Run:

```bash
npm pkg get scripts
```

Expected: npm prints the root scripts JSON.

## Task 2: Backend App Scaffold

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.app.json`
- Create: `apps/api/src/config/env.schema.ts`
- Create: `apps/api/src/config/env.validation.ts`
- Create: `apps/api/src/config/logger.config.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/main.ts`

- [x] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@elemika/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "NODE_ENV=development ts-node -r tsconfig-paths/register src/main.ts",
    "build": "tsc -p tsconfig.app.json",
    "start": "node dist/main.js",
    "lint": "tsc -p tsconfig.app.json --noEmit",
    "type-check": "tsc -p tsconfig.app.json --noEmit",
    "test": "npm run type-check",
    "migrate:local": "ts-node -r tsconfig-paths/register src/db/migrate.ts",
    "seed:local": "ts-node -r tsconfig-paths/register src/db/seed.ts",
    "docker:local": "bash scripts/docker/local-compose.sh up --build",
    "docker:start:local": "bash scripts/docker/local-compose.sh up",
    "docker:migrate:local": "bash scripts/docker/local-migrate.sh",
    "docker:seed:local": "bash scripts/docker/local-seed.sh",
    "docker:down:local": "bash scripts/docker/local-compose.sh down -v --remove-orphans"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.3",
    "nestjs-pino": "^4.6.1",
    "pino-http": "^11.0.0",
    "pino-pretty": "^13.1.3",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3"
  }
}
```

- [x] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "module": "CommonJS",
    "outDir": "dist",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts"]
}
```

- [x] **Step 3: Create `apps/api/tsconfig.app.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  }
}
```

- [x] **Step 4: Create `apps/api/src/config/env.schema.ts`**

```ts
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  API_PORT: number = 8080;

  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsIn(['development', 'test', 'stage'])
  NODE_ENV: string = 'development';

  @IsString()
  RABBITMQ_HOST!: string;

  @IsNumber()
  RABBITMQ_PORT: number = 5672;
}
```

- [x] **Step 5: Create `apps/api/src/config/env.validation.ts`**

```ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { EnvironmentVariables } from './env.schema';

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Environment validation failed:\n${messages}`);
  }

  return validatedConfig;
}
```

- [x] **Step 6: Create `apps/api/src/config/logger.config.ts`**

```ts
import { IncomingMessage } from 'node:http';
import { Params } from 'nestjs-pino';

export function getPinoLoggerConfig(): Params {
  return {
    forRoutes: ['/{*path}'],
    pinoHttp: {
      autoLogging: {
        ignore: (req: IncomingMessage & { url?: string }) =>
          req.url?.startsWith('/health') ?? false,
      },
      level: process.env.APP_LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      transport:
        process.env.NODE_ENV === 'stage'
          ? undefined
          : {
              options: { colorize: true, translateTime: 'SYS:standard' },
              target: 'pino-pretty',
            },
    },
  };
}
```

- [x] **Step 7: Create `apps/api/src/health/health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok', service: 'api' };
  }
}
```

- [x] **Step 8: Create `apps/api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from './config/env.validation';
import { getPinoLoggerConfig } from './config/logger.config';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    LoggerModule.forRoot(getPinoLoggerConfig()),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
})
export class AppModule {}
```

- [x] **Step 9: Create `apps/api/src/main.ts`**

```ts
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: ['http://localhost:5173'],
  });

  const port = Number(process.env.API_PORT ?? 8080);
  await app.listen(port);

  app.get(Logger).log(`API listening on http://localhost:${port}`);
}

void bootstrap();
```

- [ ] **Step 10: Install dependencies and verify backend type-check**

Run:

```bash
npm install
npm --workspace apps/api run type-check
```

Expected: npm installs workspace dependencies, then TypeScript exits with status `0`.

## Task 3: Backend Docker Compose Stack

**Files:**

- Create: `apps/api/Dockerfile`
- Create: `apps/api/compose.local.yml`
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/src/db/seed.ts`
- Create: `mocks/persistence-service/package.json`
- Create: `mocks/persistence-service/Dockerfile`
- Create: `mocks/persistence-service/src/server.mjs`

- [x] **Step 1: Create `apps/api/src/db/migrate.ts`**

```ts
console.log('No database migrations defined for Phase 0');
```

- [x] **Step 2: Create `apps/api/src/db/seed.ts`**

```ts
console.log('No database seed data defined for Phase 0');
```

- [x] **Step 3: Create `apps/api/Dockerfile`**

```dockerfile
FROM node:24-alpine

RUN apk add --no-cache bash

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY mocks/persistence-service/package.json ./mocks/persistence-service/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 8080

CMD ["npm", "run", "dev"]
```

- [x] **Step 4: Create mock persistence service `package.json`**

```json
{
  "name": "@elemika/persistence-service-mock",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.mjs"
  }
}
```

- [x] **Step 5: Create mock persistence service Dockerfile**

```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src

EXPOSE 8090

CMD ["npm", "start"]
```

- [x] **Step 6: Create mock persistence service server**

```js
import http from 'node:http';

const port = Number(process.env.PORT ?? 8090);

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok', service: 'persistence-mock' }));
    return;
  }

  res.statusCode = 501;
  res.end(JSON.stringify({ message: 'Persistence mock behavior starts in Phase 1' }));
});

server.listen(port, () => {
  console.log(`Persistence mock listening on ${port}`);
});
```

- [x] **Step 7: Create `apps/api/compose.local.yml`**

Important: `migrate` and `seed` include explicit `image` keys. The shell scripts use these image names for cleanup after the one-off containers finish.

```yaml
services:
  api:
    image: ${COMPOSE_PROJECT_NAME:-elemika_api_local}_api
    container_name: ${COMPOSE_PROJECT_NAME:-elemika_api_local}-api
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
    env_file:
      - ../../.env.example
    environment:
      API_PORT: 8080
      DATABASE_URL: postgres://elemika:elemika@postgres:5432/elemika
      RABBITMQ_HOST: rabbitmq
    ports:
      - '8080:8080'
    volumes:
      - ../../apps/api/src:/app/apps/api/src
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      persistence-mock:
        condition: service_started

  postgres:
    image: postgres:16-alpine
    container_name: ${COMPOSE_PROJECT_NAME:-elemika_api_local}-postgres
    environment:
      POSTGRES_USER: elemika
      POSTGRES_PASSWORD: elemika
      POSTGRES_DB: elemika
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U elemika -d elemika']
      interval: 5s
      timeout: 5s
      retries: 10
    volumes:
      - elemika_api_postgres_data:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: ${COMPOSE_PROJECT_NAME:-elemika_api_local}-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: elemika
      RABBITMQ_DEFAULT_PASS: elemika
    ports:
      - '5672:5672'
      - '15672:15672'
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'ping']
      interval: 10s
      timeout: 5s
      retries: 10

  persistence-mock:
    image: ${COMPOSE_PROJECT_NAME:-elemika_api_local}_persistence_mock
    container_name: ${COMPOSE_PROJECT_NAME:-elemika_api_local}-persistence-mock
    build:
      context: ../../mocks/persistence-service
    ports:
      - '8090:8090'

  migrate:
    image: ${COMPOSE_PROJECT_NAME:-elemika_api_local}_migrate_tmp
    container_name: ${COMPOSE_PROJECT_NAME:-elemika_api_local}-migrate
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
    env_file:
      - ../../.env.example
    environment:
      DATABASE_URL: postgres://elemika:elemika@postgres:5432/elemika
    command: ['npm', 'run', 'migrate:local']
    depends_on:
      postgres:
        condition: service_healthy
    profiles:
      - tools

  seed:
    image: ${COMPOSE_PROJECT_NAME:-elemika_api_local}_seed_tmp
    container_name: ${COMPOSE_PROJECT_NAME:-elemika_api_local}-seed
    build:
      context: ../..
      dockerfile: apps/api/Dockerfile
    env_file:
      - ../../.env.example
    environment:
      DATABASE_URL: postgres://elemika:elemika@postgres:5432/elemika
    command: ['npm', 'run', 'seed:local']
    depends_on:
      postgres:
        condition: service_healthy
    profiles:
      - tools

volumes:
  elemika_api_postgres_data:
```

- [x] **Step 8: Verify compose config renders**

Run:

```bash
docker compose -f apps/api/compose.local.yml config
```

Expected: Docker Compose exits with status `0` and prints the rendered config.

## Task 4: Backend Compose Shell Scripts

**Files:**

- Create: `apps/api/scripts/docker/_local-compose-common.sh`
- Create: `apps/api/scripts/docker/local-compose.sh`
- Create: `apps/api/scripts/docker/local-migrate.sh`
- Create: `apps/api/scripts/docker/local-seed.sh`

- [x] **Step 1: Create `_local-compose-common.sh`**

```bash
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMPOSE_PROJECT_BASE_NAME="${COMPOSE_PROJECT_NAME:-elemika}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_BASE_NAME}_api_local"
export COMPOSE_PROJECT_NAME

MIGRATE_IMAGE="${COMPOSE_PROJECT_NAME}_migrate_tmp"
SEED_IMAGE="${COMPOSE_PROJECT_NAME}_seed_tmp"

COMPOSE=(
  docker
  compose
  --project-name
  "$COMPOSE_PROJECT_NAME"
  -f
  "$API_DIR/compose.local.yml"
)

cleanup_local_tool_images() {
  docker rmi "$@" 2>/dev/null || true
}
```

- [x] **Step 2: Create `local-compose.sh`**

```bash
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

"${COMPOSE[@]}" "$@"
```

- [x] **Step 3: Create `local-migrate.sh`**

```bash
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

RUN_ARGS=(run --rm migrate)
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --build migrate)
fi

echo "Running local migrations with project: $COMPOSE_PROJECT_NAME"

if "${COMPOSE[@]}" "${RUN_ARGS[@]}"; then
  STATUS=0
else
  STATUS=$?
fi

cleanup_local_tool_images "$MIGRATE_IMAGE"

exit "$STATUS"
```

- [x] **Step 4: Create `local-seed.sh`**

```bash
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_local-compose-common.sh"

RUN_ARGS=(run --rm seed)
if [[ "${1:-}" == "--build" ]]; then
  RUN_ARGS=(run --rm --build seed)
fi

echo "Running local seed with project: $COMPOSE_PROJECT_NAME"

if "${COMPOSE[@]}" "${RUN_ARGS[@]}"; then
  STATUS=0
else
  STATUS=$?
fi

cleanup_local_tool_images "$SEED_IMAGE"

exit "$STATUS"
```

- [x] **Step 5: Mark scripts executable**

Run:

```bash
chmod +x apps/api/scripts/docker/*.sh
```

Expected: command exits with status `0`.

- [ ] **Step 6: Verify migrate and seed placeholders run**

Run:

```bash
npm --workspace apps/api run docker:migrate:local
npm --workspace apps/api run docker:seed:local
```

Expected:

```text
No database migrations defined for Phase 0
No database seed data defined for Phase 0
```

## Task 5: Frontend App Scaffold With React Router

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/router.tsx`
- Create: `apps/web/src/pages/HomePage.tsx`
- Create: `apps/web/src/pages/NotFoundPage.tsx`

- [x] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@elemika/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4173",
    "lint": "tsc -b --pretty false",
    "type-check": "tsc -b --pretty false",
    "test": "npm run type-check"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/material": "^7.3.11",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.7.3",
    "vite": "^7.0.0"
  }
}
```

- [x] **Step 2: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Elemika Correction</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [x] **Step 3: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [x] **Step 4: Create `apps/web/tsconfig.node.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["vite.config.ts"]
}
```

- [x] **Step 5: Create `apps/web/vite.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

- [x] **Step 6: Create `apps/web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [x] **Step 7: Create `apps/web/src/pages/HomePage.tsx`**

```tsx
import { Paper, Stack, Typography } from '@mui/material';

export function HomePage() {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography component="h1" variant="h5">
          Elemika Correction
        </Typography>
        <Typography color="text.secondary">
          Local frontend shell is running. Correction UI starts in Phase 3.
        </Typography>
      </Stack>
    </Paper>
  );
}
```

- [x] **Step 8: Create `apps/web/src/pages/NotFoundPage.tsx`**

```tsx
import { Alert } from '@mui/material';

export function NotFoundPage() {
  return <Alert severity="warning">Page not found</Alert>;
}
```

- [x] **Step 9: Create `apps/web/src/router.tsx`**

```tsx
import { createBrowserRouter } from 'react-router-dom';

import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <HomePage />,
    path: '/',
  },
  {
    element: <NotFoundPage />,
    path: '*',
  },
]);
```

- [x] **Step 10: Create `apps/web/src/App.tsx`**

```tsx
import { Container, CssBaseline } from '@mui/material';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';

export function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <RouterProvider router={router} />
      </Container>
    </>
  );
}
```

- [x] **Step 11: Create `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 12: Refresh dependencies and verify frontend type-check**

Run:

```bash
npm install
npm --workspace apps/web run type-check
```

Expected: npm installs any newly added web dependencies, then TypeScript exits with status `0`.

## Task 6: Local Run Verification

**Files:**

- Modify only if a previous task exposes a mismatch.

- [ ] **Step 1: Confirm dependencies are installed**

Run:

```bash
npm install
```

Expected: npm exits with status `0`; `package-lock.json` exists.

- [ ] **Step 2: Start backend Docker stack**

Run:

```bash
npm --workspace apps/api run docker:local
```

Expected services:

```text
elemika_api_local-api
elemika_api_local-postgres
elemika_api_local-rabbitmq
elemika_api_local-persistence-mock
```

- [ ] **Step 3: Verify backend health**

Run:

```bash
curl http://localhost:8080/health
```

Expected:

```json
{ "status": "ok", "service": "api" }
```

- [ ] **Step 4: Verify persistence mock health**

Run:

```bash
curl http://localhost:8090/health
```

Expected:

```json
{ "status": "ok", "service": "persistence-mock" }
```

- [ ] **Step 5: Verify placeholder migrate and seed**

Run:

```bash
npm --workspace apps/api run docker:migrate:local
npm --workspace apps/api run docker:seed:local
```

Expected:

```text
No database migrations defined for Phase 0
No database seed data defined for Phase 0
```

- [ ] **Step 6: Start frontend**

Run:

```bash
npm --workspace apps/web run dev
```

Expected:

```text
Local:   http://localhost:5173/
```

- [ ] **Step 7: Verify frontend route**

Open:

```text
http://localhost:5173/
```

Expected visible content:

```text
Elemika Correction
Local frontend shell is running. Correction UI starts in Phase 3.
```

- [ ] **Step 8: Verify workspace checks**

Run:

```bash
npm run type-check
npm run build
```

Expected: Turborepo exits with status `0`.

- [ ] **Step 9: Stop backend stack**

Run:

```bash
npm --workspace apps/api run docker:down:local
```

Expected: Docker Compose removes the local backend containers and network.

## Phase 1 Handoff

Phase 1 should start from this local scaffold and add backend foundation work:

- Schema-first NestJS GraphQL module.
- SDL folder and first minimal schema.
- Generated TypeScript definitions from SDL.
- TypeORM setup and first real migration once DB entities are designed.
- Persistence HTTP client interface.
- Persistence mock behavior for document read/write.
- RabbitMQ module connection wrapper.
- Auth guard skeleton if needed for backend foundation.

## Phase 2 Handoff

Phase 2 should implement backend correction flow:

- Shared correction contracts package if still needed.
- Document registry.
- Flatten service.
- Merge service.
- Correction query/mutation.
- Correction session/edit entities.
- Corrected-document RabbitMQ publish.

## Phase 3 Handoff

Phase 3 should implement frontend foundation:

- Apollo Client.
- Auth provider for JWT/OIDC modes.
- Generated GraphQL client types.
- Correction route shell.
- Loading/error/empty states.
- Initial API-backed correction document fetch.

## Self-Review Checklist

- [x] Phase 0 contains only local setup and runnability.
- [x] No shared contracts package is created in Phase 0.
- [x] No GraphQL SDL/resolver implementation is created in Phase 0.
- [x] No real DB migration is created in Phase 0.
- [x] `src/db/seed.ts` is only a placeholder that exits successfully.
- [x] Persistence mock only launches and serves health in Phase 0.
- [x] `migrate` and `seed` compose services include explicit `image` keys.
- [x] React Router is included in the frontend scaffold.
- [x] Apollo/auth/correction UI are moved to Phase 3.
