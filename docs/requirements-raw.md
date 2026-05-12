# Project context

We are building a new web-based correction screen that lets users review and edit structured data extracted from supplier
documents before it is delivered to a downstream system of record.

## Planned tasks

The work breaks down across three areas. The two contractors split this between them. Tasks are at MVP scope; later phases extend the same components.

**Frontend — correction screen**

- Build a form-based screen for reviewing and editing structured fields, grouped into header, line-item and nested-row sections.
- Implement dynamic field rendering driven by server-supplied schema metadata (text, date, number, and code-list inputs).
- Wire up form state, client-side validation and inline error display with react-hook-form, where the validation schema is generated
  from server metadata at runtime.
- Build the provenance UX: source badges per field, edit-history popover, top-level validation banner, submit-confirmation dialog.
- Implement the data-fetching hook and service module that talks to the GraphQL API.
- Storybook stories and unit tests (Vitest + React Testing Library) for every component shipped. Integration and e2e tests.
- CI/CD (GitHub Actions), packaging, lint and test gates.

**Backend — NestJs GraphQL service and pipeline**

- Design and implement the GraphQL schema additions: queries, mutations, types, enums and inputs.
- Implement controllers with method-level authorization against the existing OAuth2 setup.
- Build the flattening layer that converts a hierarchical document tree into a flat field DTO list, carrying provenance metadata.
- Build the merge layer that applies user edits back onto the tree, stamping audit metadata (user, timestamp, previous value,
  source).
- Implement a schema-driven document-type registry — adding a new document type is a config change, not a code change.
- Handle optimistic locking and version-conflict reconciliation against the persistence layer.
- Unit/integration/e2e tests in a dev environment.

**Integration and data**

- Wire the backend into a message-based pipeline (RabbitMQ) so corrected documents flow back into existing processing.
- Read and write document state through an existing internal persistence service over HTTP.
- Emit correction-event payloads for downstream analytics, with a log-based fallback when the intake endpoint is unavailable.
- Coordinate the replay/reprocess flow so a corrected document can be re-run through extraction and enrichment without manual
  intervention.
- CI/CD (GitHub Actions), packaging, lint and test gates.

**Tech stack**

**Frontend**

- React
- Material UI
- react-hook-form
- Apollo GraphQL Client
- OAuth2 / OpenID Connect (react-oidc-context)
- Vitest, React Testing Library, Storybook
- Playwright
- ESLint, Prettier, npm

**Backend (only core)**

- NestJs
- Postgresql, TypeORM
- graphql
- amqplib
- Redis
- Docker

Detailed prompt

1. scan /Users/ichernob/Desktop/learn/r_d/rd_shop to analyse which parts can be re-used or taken as references (skip .temp/ and demo/ folders). potential candidates: from apps/shop - github actions workflows, compose + docker setup, users/, auth/, graphql/, common/, config/, core/ db/, files/, rabbitmq from libs/common - config/, database/, environment/, utils/. note, BE should be a monolith, so no apps/ and libs/ in our project. also, auth flow can be simplified, so no reset token and email confirmations, also no audit logs, just simple Pino, no additional observability and aws metrics.
   1.1 I'd prefer having Docker file / compose file per stack, i.e. I don't want to mix neither local setup, nor deployment for FE/BE
2. preferred monorepo setup: npm workspaces + Turborepo (if desagree - suggest alternative)
3. FE also needs auth flow (jwt-based and OAuth2 / OpenID Connect)
4. based on above conversation create a general-plan.md inside docs/ folder. it should contain:

- overall project description and architecture, graphql shemas / contracts
- BE flow breakdown, DB entities schemas
- FE flow breakdown + schemas
- proposed monorepo setup, the list of technologies (FE/BE)
- P0/P1/P2 grouped by stack (FE/BE)
- all "deferred" features description, like WebSockets + Redis
- Detailed analysis what can be re-used from rd_shop NestJs backend
- Implementation phases(project setup as Phase 0), no actual steps/changes, just analysis what should be done. Should BE and FE be implemented together or BE first

5. Proposed CI/CD strategy (no 'production', just stage for simplicity) per stack.

phase 0
extract cors setup into setupCors function (get usage example from rd_shop)
in #sym:origin use CORS_ALLOWED_ORIGINS env var (get usage sxample from rd_shop)

I don't see any DB config . db folder contains only migrate/seed. use rd_shop to get proper DB config

test2@test.com
pass1234
