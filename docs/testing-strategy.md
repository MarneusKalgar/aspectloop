# Testing Strategy

Status: Confirmed direction  
Date: 2026-07-26  
Scope: Frontend, backend, contracts, local infrastructure, and deployed stage

## Table Of Contents

- [1. Purpose](#1-purpose)
- [2. Confirmed Decisions](#2-confirmed-decisions)
- [3. Test Taxonomy](#3-test-taxonomy)
- [4. Current Repository State](#4-current-repository-state)
- [5. MSW Strategy](#5-msw-strategy)
- [6. End-To-End Modes](#6-end-to-end-modes)
- [7. Local Versus Stage System E2E](#7-local-versus-stage-system-e2e)
- [8. Infrastructure Strategy](#8-infrastructure-strategy)
- [9. Reliability Rules](#9-reliability-rules)
- [10. Milestone Ownership](#10-milestone-ownership)
- [11. Priority Summary](#11-priority-summary)

## 1. Purpose

This document defines the durable testing vocabulary and direction for the
repository. Detailed commands, fixtures, CI jobs, and coverage targets belong
in the implementation plan for the milestone that introduces them.

The strategy separates:

- the tool that executes a test;
- the application boundary exercised by the test;
- whether dependencies are real, simulated, or deployed;
- whether a test is intended for local feedback, pull-request gating, or stage
  validation.

Playwright is a browser automation and test runner. Using Playwright does not,
by itself, make a test a full-system end-to-end test.

## 2. Confirmed Decisions

1. Keep MSW for frontend integration tests and mocked browser workflows.
2. Treat the existing Playwright suite as mocked frontend E2E, not full-stack
   system E2E.
3. Keep mocked frontend E2E after real backend testing is introduced. The two
   suites provide different signals.
4. Do not restore or maintain a frontend-owned copy of the GraphQL SDL.
5. Validate frontend operations against gateway-owned SDL through GraphQL
   Code Generator.
6. Keep MSW handlers operation-specific by default. Do not turn MSW into a
   second implementation of the gateway.
7. Add a thin local system E2E suite only when it provides pre-merge or local
   integration value beyond focused frontend and backend tests.
8. Make deployed stage smoke mandatory once stage deployment exists.
9. Reuse portable system specifications between local and stage targets where
   their business preconditions are equivalent.
10. Mock only true external boundaries in system tests. Runtimes owned by this
    repository should be real.

## 3. Test Taxonomy

| Layer                | Runner examples                               | Browser  | Dependency boundary                                           | Primary signal                                                     |
| -------------------- | --------------------------------------------- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Unit                 | Vitest                                        | No       | Collaborators replaced with focused fakes                     | Pure logic and component behavior                                  |
| Frontend integration | Vitest, React Testing Library, MSW Node       | JSDOM    | GraphQL network mocked                                        | React, routing, providers, Apollo, and error handling              |
| Backend integration  | Backend test runner, real test infrastructure | No       | Database, queue, object storage, or HTTP adapters as required | Repository, resolver, service, and infrastructure behavior         |
| Contract             | Codegen and contract-specific test runner     | No       | Canonical schema or versioned contract                        | GraphQL SDL, operations, events, and provider-output compatibility |
| Mocked frontend E2E  | Playwright and MSW browser worker             | Yes      | Backend mocked                                                | Complete browser workflow inside the frontend boundary             |
| Backend E2E          | Backend test runner against running services  | No       | Owned backend services and infrastructure real                | Public API through backend service boundaries                      |
| Local system E2E     | Playwright against local stack                | Yes      | Owned FE/BE/infra real; external providers mocked             | Pre-deploy cross-runtime integration                               |
| Stage system E2E     | Playwright against deployed stage             | Yes      | Deployed stage topology                                       | Deployment, configuration, networking, and version compatibility   |
| AI eval              | Dedicated eval harness                        | Optional | Model/provider controlled by eval configuration               | Quality, reliability, cost, and safety                             |

AI evals remain separate from deterministic software tests even when both run
in the same CI or stage environment.

## 4. Current Repository State

### 4.1 Browser mock runtime

`apps/web/src/main.tsx` starts the MSW browser worker when
`VITE_MOCK_GQL_RUNTIME=true`.

In mock mode:

- Apollo sends GraphQL requests to `/graphql`;
- `apps/web/public/mockServiceWorker.js` intercepts browser traffic;
- handlers come from `apps/web/src/mocks/handlers/graphql.ts`;
- unhandled browser requests currently use `bypass`.

The runtime flag defaults to `false`, so normal local live mode targets the
configured gateway URL.

### 4.2 Vitest

`apps/web/src/test/setup.ts` starts `setupServer` from `msw/node` for the
current Vitest configurations.

- unit and integration tests share the handler set;
- handlers reset after each test;
- unhandled requests fail with `onUnhandledRequest: 'error'`;
- integration tests exercise React, routing, Apollo, auth state, and MSW
  together without starting the backend.

### 4.3 Playwright

`apps/web/playwright.config.ts` starts Vite with
`VITE_MOCK_GQL_RUNTIME=true`.

The current Playwright auth tests therefore exercise:

```text
browser -> React -> Apollo Client -> MSW
```

They do not exercise:

```text
NestJS -> GraphQL transport -> services -> PostgreSQL -> RabbitMQ
```

The tests are valid mocked frontend E2E tests, but the current `test:e2e` name
does not communicate that boundary.

### 4.4 Current mock drift

The handler module contains handwritten variable casts and response bodies.
It also contains `Me` and `CorrectionSession` handlers without corresponding
currently generated frontend operations.

This does not prove those handlers are incorrect, but it shows that mock
coverage and frontend operation coverage can drift independently.

MSW is not currently integrated with Storybook.

## 5. MSW Strategy

### 5.1 Intended ownership

MSW owns deterministic frontend-facing behavior required by:

- frontend integration tests;
- mocked browser E2E;
- optional backend-less local UI development;
- controlled success, validation, authorization, conflict, timeout, and
  unavailable-service scenarios.

MSW does not own:

- the canonical GraphQL schema;
- backend domain validation;
- persistence behavior intended to prove backend correctness;
- queue or outbox reliability;
- production or stage runtime behavior.

### 5.2 GraphQL schema decision

Standard MSW `graphql.query` and `graphql.mutation` handlers match named
operations and return mocked responses. They do not require an SDL.

MSW can execute intercepted operations against a schema, but doing so still
requires mock root resolvers and state. For this repository, schema-first MSW
is conditional rather than the default because it can grow into a second mock
backend.

The preferred contract chain is:

```text
gateway-owned SDL
  -> GraphQL Code Generator validates frontend documents
  -> generated operation and variable types
  -> typed MSW handlers and fixtures
```

No schema file is copied into `apps/web`.

### 5.3 Handler hardening

Future MSW hardening should:

- type variables and response fixtures from generated operation types;
- remove avoidable handwritten casts;
- scope handlers to the intended GraphQL endpoint;
- make unhandled requests fail in automated mocked suites;
- split handlers by domain when the current single module becomes difficult to
  navigate;
- review handlers with no matching frontend operation;
- keep stateful behavior minimal and deterministic;
- avoid reproducing backend business rules.

Schema-executed MSW may be reconsidered if broad backend-less development or
Storybook scenarios provide a measured reason for it.

## 6. End-To-End Modes

The intended commands are conceptually:

```text
test:e2e:mock
test:e2e:local
test:e2e:stage
```

Exact scripts and Playwright configurations are introduced by their owning
milestones.

### 6.1 Mocked frontend E2E

Target:

```text
Playwright -> local web -> MSW
```

Use it for:

- broad frontend workflow coverage;
- UI navigation and state transitions;
- deterministic validation and error paths;
- scenarios that would be expensive or unsafe to produce in a real backend.

### 6.2 Local system E2E

Target:

```text
Playwright
  -> local served web
  -> local gateway
  -> local owned services
  -> isolated databases, RabbitMQ, and object storage
  -> deterministic mocks for external providers
```

The local system suite should remain thin. Candidate critical paths are:

- sign in and load the inbox;
- upload one fixture and observe extraction completion;
- open, save, and submit one correction;
- verify the resulting artifact or event through a public interface.

### 6.3 Stage system E2E

Target:

```text
Playwright
  -> deployed stage web
  -> deployed stage gateway and services
  -> stage databases, queue, and object storage
```

Stage testing has two levels:

1. Blocking post-deployment smoke for reachability, authentication, one
   critical workflow, and cleanup.
2. Broader scheduled or manually triggered regression for conflicts, retries,
   asynchronous behavior, and failure recovery.

No MSW worker runs in local or stage system modes.

## 7. Local Versus Stage System E2E

### 7.1 Local advantages

- runs before merge and deployment;
- tests branch changes without changing shared stage;
- provides resettable databases, queues, and object storage;
- verifies migrations and seed from an empty state;
- supports deterministic provider mocks;
- is easier to debug through direct process and container logs;
- can run as a pull-request gate anywhere Docker is available.

### 7.2 Local disadvantages

- Compose differs from cloud networking and managed services;
- scripts, ports, health checks, and images require maintenance;
- startup is slower than focused frontend or backend tests;
- it can duplicate existing local infrastructure;
- it cannot prove TLS, DNS, CDN, IAM, secret, or managed-service correctness.

### 7.3 Stage advantages

- tests deployed artifacts and actual FE/BE version compatibility;
- covers real domains, TLS, CORS, secrets, networking, and managed services;
- catches deployment and environment configuration failures;
- provides the strongest pre-promotion signal.

### 7.4 Stage disadvantages

- feedback arrives after deployment;
- shared state and concurrent runs can create nondeterminism;
- failures are harder to isolate;
- destructive reset scenarios are unsafe;
- stage or external-provider outages can block the suite;
- stage-only testing cannot gate a pull request without an ephemeral
  per-change environment.

### 7.5 Decision

Do not build a broad local system suite that duplicates frontend MSW and
backend integration coverage.

Introduce a dedicated local E2E environment only when at least one of these is
required:

- deterministic reset for system tests;
- pre-merge full-stack CI;
- parallel execution without affecting the developer stack;
- migration and seed verification from empty infrastructure;
- reliable reproduction of cross-service failures.

Until then, the existing local stack may support human smoke checks and a small
system test without a separate Compose definition.

Stage smoke remains mandatory once stage deployment exists, regardless of
whether a dedicated local E2E stack has been introduced.

## 8. Infrastructure Strategy

### 8.1 Dedicated local E2E stack

When justified, adapt the established `rd_shop` pattern rather than copying it
blindly.

Expected characteristics:

- separate Compose project name;
- isolated networks and ports;
- temporary or disposable database and object-storage volumes;
- one database per owning service;
- health checks rather than arbitrary sleeps;
- one-shot migration and seed services;
- real repository-owned application containers;
- deterministic mocks for external persistence and AI providers;
- one command for fresh startup;
- deterministic teardown of containers, volumes, or local tool images.

The web application does not need a container. Playwright may start a built
static preview or Vite server on the host with:

```text
VITE_MOCK_GQL_RUNTIME=false
VITE_API_URL=<local-e2e-gateway-url>
```

The same Compose definition may run locally and in CI.

### 8.2 Stage support

Stage does not use the local E2E Compose stack. It requires:

- deployed FE and backend URLs;
- a deployment/version readiness check;
- dedicated test users, roles, and scopes;
- unique run identifiers and artifact prefixes;
- deterministic fixture bootstrap;
- safe cleanup through normal APIs or pipeline-executed stage jobs;
- CI-managed credentials;
- Playwright traces, screenshots, and relevant service logs on failure.

Do not add public test-only endpoints. Prefer normal APIs or restricted
pipeline jobs for setup and cleanup.

### 8.3 Portable system specifications

Local and stage modes should share business-level Playwright specifications
where practical. Environment adapters own:

- base URLs;
- authentication credentials;
- fixture bootstrap;
- readiness checks;
- cleanup;
- access to diagnostics.

This avoids maintaining separate local and stage copies of the same workflow.

## 9. Reliability Rules

- Fail automated mocked tests on unhandled network requests.
- Use health or readiness checks instead of fixed sleeps.
- Use unique test-run identifiers for persistent stage data.
- Keep tests independent of execution order.
- Reset mutable local test state between suites or runs.
- Do not use retries to conceal deterministic failures.
- Retain traces, screenshots, request identifiers, and service logs on failure.
- Keep blocking stage smoke small.
- Run broader stage regression on a schedule or explicit request.
- Test provider-independent release behavior with deterministic provider mocks.
- Keep live AI provider evaluation outside deterministic release gates.

## 10. Milestone Ownership

| Milestone     | Testing responsibility                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| M01.1         | Preserve current MSW behavior while correcting GraphQL transport and frontend schema/codegen ownership; no MSW redesign |
| M03           | Establish terminology, root verification commands, suite naming, local/CI quality gates, and review workflow            |
| M04           | Make databases, migrations, seed, MinIO, and local service infrastructure reusable by tests                             |
| M05-M06       | Add focused extraction and correction service integration and contract coverage                                         |
| M07           | Add the first portable upload-to-submit local system Playwright workflow                                                |
| M08           | Add deterministic retry, DLQ, idempotency, outbox, and reprocess failure coverage                                       |
| M09           | Add realtime integration coverage without coupling Socket.IO tests to GraphQL subscriptions                             |
| M10           | Harden contract, system E2E, security, observability, fixtures, cleanup, and failure diagnostics                        |
| M11           | Execute portable system specifications against stage and make the smoke subset a deployment gate                        |
| AI milestones | Add eval harnesses and provider comparisons separately from deterministic software gates                                |

## 11. Priority Summary

### P0

- preserve and correctly classify existing MSW/Vitest/Playwright coverage;
- validate frontend operations against gateway-owned SDL through codegen;
- add focused backend integration and contract tests with each domain feature;
- add a thin local system happy path once the real workflow exists;
- add blocking stage smoke when stage deployment exists.

### P1

- type and reorganize MSW handlers;
- add a dedicated local E2E Compose stack when isolation or CI requires it;
- add broader stage regression and failure scenarios;
- improve cross-service diagnostics and test-data cleanup.

### P2 or conditional

- schema-executed MSW;
- per-pull-request ephemeral cloud environments;
- broad cross-browser system matrices;
- destructive resilience scenarios against deployed environments.
