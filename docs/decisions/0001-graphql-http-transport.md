# 0001 GraphQL HTTP Transport

Status: Accepted  
Date: 2026-08-02

## Context

The gateway uses schema-first `@nestjs/graphql` with NestJS on Express. Its
Apollo Server transport became unresolvable: `@nestjs/apollo@13.4.0` requires
Apollo Server 5 while its deprecated GraphQL Playground compatibility package
requires Apollo Server 4. The resulting peer conflict prevents a normal npm
audit fix and retains an obsolete server dependency path.

The public SDL, resolver guards, and the React Apollo Client are independent of
the HTTP transport. GraphQL request context must continue to expose the
original Express request as `context.req` because JWT, role, scope, and
current-user helpers read it through `GqlExecutionContext`.

## Decision

Use `@graphql-yoga/nestjs` and `graphql-yoga` as the GraphQL HTTP transport.
Keep NestJS, Express, `@nestjs/graphql`, schema-first SDL, generated Nest
resolver definitions, `/graphql`, and the web Apollo Client.

Nest owns CORS, `/health`, application shutdown, and Pino HTTP logging. Yoga
owns only GraphQL request processing, with its CORS and request logging
disabled. The Yoga context returns `{ req }` without changing the existing
guards or decorators.

GraphiQL and schema introspection are enabled in development and test. In
stage and production, GraphiQL is disabled and Yoga's validation-plugin
extension adds GraphQL's standard `NoSchemaIntrospectionCustomRule`. The former
custom introspection header and Apollo lifecycle plugin are removed. Remote
introspection is not supported in this MVP.

Yoga error masking is enabled explicitly. A central mask preserves deliberate
Nest 4xx exception messages and maps their status to stable GraphQL extension
codes. All other resolver, infrastructure, and programming errors become
`Unexpected error.` with `INTERNAL_SERVER_ERROR`; no resolver or service adds
transport-specific error handling.

## Alternatives Rejected

- `npm audit fix --force`, `--legacy-peer-deps`, and incompatible Apollo peer
  overrides: they hide an invalid dependency graph and retain obsolete code.
- Fastify/Mercurius: changes the HTTP platform without solving an MVP need.
- A custom GraphQL HTTP driver: adds transport code the project must own.
- Continuing with the Apollo Playground compatibility package: it is the
  deprecated source of the incompatible Apollo Server 4 path.

## Migration

Dependency manifests and the root lockfile are changed only through human-run
npm commands. The application migration replaces the Apollo driver
configuration and its lifecycle plugin, then removes the corresponding
schema-auth environment variable and log redaction. No SDL, resolver, guard,
or frontend operation changes are part of this decision.

## Consequences

The gateway remains an Express NestJS application, but Apollo Server-specific
plugins and configuration are no longer available. Future federation,
subscriptions, persisted operations, query-cost protection, and GraphQL Armor
are separate decisions. Socket.IO remains the future realtime transport.

The migration changes no SDL or operation contract. Frontend code continues to
depend on GraphQL response messages; it does not currently branch on extension
codes. Human verification must cover successful operations, unauthenticated
access, invalid input, protected correction access, and an unexpected failure.

Review this decision if a future NestJS release no longer supports the Yoga
driver, if federation becomes necessary, if the Java backend replaces the
gateway, or if resolver-level workarounds begin to accumulate.
