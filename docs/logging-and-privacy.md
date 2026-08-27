# Logging And Privacy Contract

AspectLoop uses structured application events for local diagnostics and future
portable observability. This baseline applies to the gateway, extraction
service, and correction service. It deliberately does not introduce
OpenTelemetry, metrics, traces, log aggregation, or dashboards; those remain
M10 work.

## Event Contract

Every backend log includes a stable `service` field. Logs emitted inside an HTTP
request also inherit a bounded `requestId`. Event-specific fields use the same
names across services:

- `event`: stable dotted event name;
- `requestId`: accepted bounded caller ID or a generated UUID;
- `method`: bounded uppercase HTTP method;
- `route`: registered route template, never the caller's raw unmatched path;
- `statusCode`: HTTP response status;
- `durationMs`: rounded non-negative request duration;
- `operationName`: bounded GraphQL operation name or `<anonymous>`;
- `outcome`: `success`, `client_error`, `server_error`, or `failure` as relevant;
- approved business identifiers such as `userId`, `documentId`, `sessionId`, or
  `outboxId` when they are required to diagnose a named event.

The HTTP layer emits one `http.request.completed` event per non-health request.
Successful responses use `info`, client errors use `warn`, and server/runtime
errors use `error`. Routine `/health` completion logs are suppressed.

GraphQL execution emits one `graphql.operation.completed` event with only the
bounded operation name and outcome. Anonymous operations use `<anonymous>`.
Internal failures may also emit `graphql.operation.failed` with a bounded error
class name, never an error message, stack, document, variables, or result.

Authentication events use internal user IDs only. Invalid-account and
invalid-password attempts both use `auth.sign_in.failed` with the same
`invalid_credentials` reason. `auth.sign_in.succeeded` is emitted only after
access-token generation succeeds.

## Request IDs

The gateway and service runtimes accept `x-request-id` only when it is 1-128
characters and contains ASCII letters, digits, `.`, `_`, `:`, or `-`, beginning
with a letter or digit. Missing, repeated, malformed, or oversized values are
replaced with a UUID. The selected value is returned in the `x-request-id`
response header and used by request-scoped logs.

Request IDs are correlation values, not authorization or trust signals.

## Excluded Data

The following data must not be logged by default:

- complete request or response objects;
- headers, authorization values, cookies, query strings, route parameters, and
  bodies;
- GraphQL documents, source text, variables, and result payloads;
- passwords, password hashes, access/refresh tokens, or generic token fields;
- raw or normalized email addresses;
- document payloads/content, extraction source data, prompts, or model output.

Pino redaction is defense in depth. Call sites must still construct bounded
events and must never interpolate sensitive values into log strings, where
field-based redaction cannot remove them.

## Environment Behavior

Local development uses `pino-pretty` for readable stdout. `stage` and
`production` configuration emit JSON without a pretty transport. Logger setup
remains service-owned even though the field vocabulary and bounded HTTP
mechanics are shared. `packages/backend-platform` owns those mechanics; each
NestJS application keeps a thin adapter that supplies its service name and
validated environment values.

The shared environment validator also owns initialization of
`reflect-metadata`, which `class-transformer` requires for decorator metadata
and implicit conversion. Each NestJS application retains its direct
`reflect-metadata` dependency for its own framework runtime.

Temporary diagnostic logging must be explicit, narrowly scoped, redacted, and
removed before merge. Restoring full request or payload serialization is not an
acceptable diagnostic shortcut.

## Verification

Run the focused source-based contract tests directly from the repository root:

```bash
npm run test:logging:run
```

The platform tests import `packages/backend-platform/src`; the gateway GraphQL
tests import gateway source. They do not import sibling application internals or
require pre-existing `dist` directories.

Then exercise health, sign-up, successful/failed sign-in, current-user, and
correction-inbox operations through the local UI or GraphiQL. Inspect Compose
logs and verify that related events share a request ID and that none of the
excluded values appear. The complete human checklist remains in the M03 plan.
