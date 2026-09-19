# Contracts

`@aspectloop/contracts` is the framework-free public boundary for contracts shared
by independently deployed runtimes.

Add transport, event, or provider contracts only when at least two runtimes
need the same stable shape. Do not place NestJS modules, TypeORM entities,
GraphQL resolver definitions, React types, or gateway-only domain types here.

## Identity-session boundary

The M04.2 auth schemas under `src/platform/auth` define a private Platform boundary.
Session-bearing responses may contain an opaque refresh token for Gateway, but
Gateway must project them into the public GraphQL `AuthPayload` explicitly. A
refresh token must never be spread into a GraphQL response, log, or error.

The new session schemas and routes are contract-first additions. Existing
M04.1 sign-in, sign-out, and sign-up endpoint bindings remain in place until the
Platform and Gateway cutovers in M04.2-B/C; consumers must not assume the new
routes are runtime-ready before those sections are complete.
