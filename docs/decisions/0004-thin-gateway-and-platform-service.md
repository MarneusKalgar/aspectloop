# 0004 Thin Gateway And Platform Service

Status: Accepted

Date: 2026-09-10

## Context

The current `gateway-api` is a transitional hybrid. It owns the public GraphQL
boundary and browser authentication transport, but it also owns the
`platform_db` datasource, users and identity behavior, document/source-object
metadata, platform storage credentials, migrations, seeds, and platform outbox
work. Leaving those responsibilities together would turn the gateway into the
platform domain and make later extraction and correction integration harder to
reason about.

M04 review also found two ownership-sensitive weaknesses:

1. the current source-artifact adapter performs `HeadObject` followed by
   `PutObject`; Garage 2.3 does not make `If-None-Match` an atomic create-only
   guard, so concurrent writers can both succeed; and
2. TypeORM's application-level `update: false` metadata does not prevent the
   database-owning runtime role from changing or deleting `document_object`
   rows with raw SQL.

Neither problem should be hidden behind a gateway-specific workaround just
before the data and behavior move to their durable owner.

## Decision

Create `apps/platform-service` in M04.1 and make it the sole runtime owner of
platform domain state. The move is behavior-preserving first: it moves the
existing platform datasource, users and identity business logic,
document/source-object metadata, platform artifact port and credentials,
migrations, seeds, and platform outbox/process-manager responsibilities out of
`gateway-api` without redesigning the public GraphQL contract.

Identity remains part of Platform. A separate identity service is not planned.
M04.2 follows the ownership move with authoritative browser sessions, email
confirmation, and related auth hardening. The original JWT/refresh mechanism
was superseded on 2026-09-20 by
[ADR 0005](0005-browser-session-cookie-and-platform-validation.md): opaque
session cookies and Platform/PostgreSQL validation. That cutover is pending;
it does not change the service-ownership decision here.

After M04.1, the gateway owns only edge concerns for Platform/document flows:

- public GraphQL SDL, resolvers, and transport mapping;
- cookie transport, authenticated request context, and coarse role/scope
  enforcement (Platform-validated sessions under the revised M04.2 target);
- input limits, public error mapping, rate limiting, correlation, and edge
  telemetry;
- lightweight request composition and realtime delivery.

The existing correction implementation remains a named transitional exception
until M06 moves it into `correction-service`. It may use only a distinct,
table-restricted legacy correction role; it must not retain Platform runtime,
migration, or artifact credentials. After M06, the gateway owns no application
database, migrations, artifact-store credentials, durable workflow state, or
domain outbox. Resource ownership and state-transition authorization stay with
the owning service.

Platform owns:

- `platform_db`, users, identity, credentials, sessions, and verification
  state;
- document identity, source-artifact metadata, and the document registry;
- the platform source bucket and vendor-neutral S3 port;
- platform workflow coordination and its transactional outbox.

Extraction and correction keep their own databases, artifact buckets, domain
behavior, and outboxes. They do not become generic document stores.

### Concurrent Artifact Creation

Finding #1 is resolved as part of the M04.1 ownership move, before any public
upload workflow is introduced. Garage conditional requests are not the
authority for uniqueness. Platform will reserve the logical object identity in
`platform_db` through a mutable reservation/upload record protected by a
database uniqueness constraint. Only the reservation winner may upload and
finalize the immutable `DocumentObject` row. Failed or abandoned reservations
must have explicit retry/recovery states.

The implementation must not hold a database transaction open across an S3
network operation. A real-Garage concurrency test must prove that two Platform
instances cannot both finalize the same logical object identity.

### Database-Enforced Immutability

Finding #7 is hardened after the behavior-preserving move in M04.1, in the same
ownership milestone. Platform receives separate database identities for schema
ownership/migration and normal runtime access. The runtime identity receives
only the table operations it needs; for finalized `document_object` metadata,
that means `SELECT` and `INSERT`, with no `UPDATE`, `DELETE`, or `TRUNCATE`.
Mutable reservation state lives in a separate table with deliberately broader
runtime privileges. While the old correction schema remains in `platform_db`,
the gateway's temporary correction role is restricted to those legacy tables
and has no access to users, documents, source objects, reservations, or the
Platform outbox.

Administrative import or recovery remains an explicit privileged procedure,
not an application escape hatch. The privilege change must be introduced by a
new human-generated and reviewed migration or provisioning step; an already
applied migration must not be edited.

## Delivery Order

1. Apply bounded M04 corrections that do not depend on service ownership.
2. M04.1 extracts Platform without changing externally observable behavior,
   then adds the database reservation and runtime/migrator privilege split.
3. M04.2 stabilizes identity and browser sessions inside Platform.
4. M05 builds extraction behavior. M06 moves the remaining correction behavior
   and state to `correction-service` and hardens that domain, completing the
   database-free gateway. M05 may proceed after M04.1 in parallel with M04.2
   when contracts do not conflict.
5. M07 begins only after M04.2, M05, and M06; it must use the hardened Platform
   upload path rather than reintroducing document ownership in the gateway.

Platform extraction therefore happens immediately after M04, not after M06.

## Alternatives Considered

- **Keep the hybrid gateway.** Rejected because public transport, identity,
  document persistence, artifacts, and orchestration would share one runtime
  and deployment boundary.
- **Create a separate identity service now.** Rejected because the current
  product and scale do not justify another distributed boundary; identity is a
  coherent Platform responsibility.
- **Move document ownership into extraction or correction.** Rejected because
  document identity and source registration precede both domains, and neither
  service should own the other's lifecycle.
- **Delay Platform extraction until after M06.** Rejected because M05-M07 would
  otherwise build new integrations against a boundary already known to be
  temporary, increasing migration and test debt.
- **Rely on S3 conditional writes or a database trigger alone.** Rejected as the
  primary design. Garage 2.3 does not provide the required atomic condition,
  while a trigger does not model upload reservation/failure state and is not a
  security boundary when the runtime owns the database.

## Consequences

M04.1 is larger than the old identity-only follow-up, but it reduces total
rework by establishing ownership before M05-M07 add workflows. M04.2 preserves
the identity deliverable instead of folding behavior redesign into the
extraction. Internal Platform contracts and failure handling become explicit.
M04.1 removes Platform state from the gateway; M06 removes its temporary
correction state, after which the edge can scale without colocated durable
state.

M04.1 implemented the full ownership boundary: Platform behavior, persistence
code, storage credentials, migrations, and seeds live in `platform-service`;
`platform_migrator`, `platform_runtime`, and
`gateway_correction_runtime` enforce the database split; and the durable
reservation table serializes concurrent source-object finalization. The gateway
retains only its explicitly transitional correction persistence until M06.
