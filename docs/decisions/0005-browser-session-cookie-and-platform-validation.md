# 0005 Browser Session Cookie And Platform Validation

Status: Accepted design; C2b cutover, C3 retirement, E1 resilience and D1 mail transport locally accepted; D2-D3/E2/F pending

Date: 2026-09-20

## Context

The first-party React SPA sends application requests through the NestJS GraphQL
Gateway. No current requirement needs browser JavaScript to obtain bearer
tokens or contact internal services directly. The initial M04.2 design combined
browser access JWTs with PostgreSQL-backed rotating refresh tokens. Its A/B
contracts and persistence work passed local checks, but browser refresh, retry,
and cross-tab cookie rotation introduced substantial remaining complexity.

## Decision

Use an opaque HttpOnly session cookie for first-party browser authentication.
Web plus Gateway is a separately deployed SPA and backend-for-frontend (BFF).
This does not introduce Next.js/Nuxt or server-side rendering.

Platform issues a high-entropy credential on successful verified sign-in and
stores only its domain-separated HMAC digest with session state in PostgreSQL.
Gateway sets the cookie, and asks Platform to validate it for each protected
HTTP request. Validation checks credential, expiry, revocation, and current
user/permissions. Memoize only within that request, including an in-flight
validation promise shared by GraphQL resolvers. Gateway has no auth database,
session cache, or session authority.

No browser access JWT, rotating refresh credential, refresh endpoint, or
automatic authentication-driven GraphQL retry remains in the target flow.
The session credential is stable for that login; a new sign-in issues a fresh
credential. Absolute expiry bounds its lifetime; eligible activity may extend
inactivity expiry without exceeding that bound. Expired sessions require login.
Session fixation is prevented by never accepting a supplied credential as the
identity of a newly issued session. Regeneration for future privilege elevation
or account recovery must be designed with those future features.

Gateway classifies session activity from executable product root fields of the
selected GraphQL operation, honoring `@skip` and `@include` on fields, inline
fragments, and fragment spreads with request variables and operation defaults.
`me` alone or combined with skipped product fields validates once without
recording activity. Pre-execution mutation isolation continues to inspect
declared roots, so skipping a product field does not relax sole-root restrictions.

The cookie is host-only `aspectloop_session`, scoped to `/graphql`, HttpOnly,
SameSite=Lax, and Secure in stage/production. Local HTTP is the explicit Secure
exception. Cookie expiry is the absolute session deadline; Platform enforces
the possibly earlier inactivity deadline. Requests do not rewrite the cookie
when recording activity. Set and clear attributes must match exactly.

All browser GraphQL traffic uses credentialed requests. Mutations require JSON
POST and an exact approved Origin before execution; GraphQL HTTP batching is
rejected. Sign-in/sign-out each occupy the sole root field. Queries must have
no application side effects. Credentialed CORS uses explicit origins, and
SameSite supplements rather than replaces CSRF controls. Local GraphiQL uses
the same Origin policy. Reject duplicate authentication cookies.

Browser memory holds only user/UI state. `localStorage` may hold a bounded
non-secret generation/logout-intent marker; no credential is placed in browser
storage, URLs, public GraphQL bodies, logs, or Apollo cache. Bootstrap calls
`me`. Logout immediately suppresses UI, attempts cache retirement and durable
intent, then requests Platform revocation under native cookie-action ordering.
Successfully persisted suppression survives reload until an explicit successful
sign-in after confirmed revocation. Unknown/orphaned outcomes block replay and
new login; manual browser reset is not proof of server revocation. A failed
marker write retains current-tab suppression but cannot guarantee peer/reload
propagation. HttpOnly reduces direct credential theft by scripts but does not
prevent XSS from acting through the browser. Baseline escaping, safe URL handling,
and no unsafe HTML are required now; production CSP deployment remains part of M10.

## PostgreSQL And Redis

PostgreSQL is the initial authoritative store, with indexed lookups, bounded
pools/timeouts, and conditional activity writes. Redis is not required for this
revision. Measure the complete Gateway/Platform/database path, including p95/p99
validation latency and pool pressure, before revisiting the store. A Redis cache
would require a separate revocation-consistency decision; a cached active
session must not silently weaken next-request revocation. A Redis authority
would require explicit durability, expiry, eviction, and failure semantics.

## Consequences

- Server validation removes the old access-JWT revocation window. A request
  authorized before revocation may finish; later validations reject it.
- Platform or database failure makes protected access unavailable and fails
  closed. It must not be presented as invalid credentials or clear a possibly
  valid cookie, except for explicit logout.
- Stable stolen credentials remain usable until expiry/revocation. This design
  does not claim the superseded refresh-token replay-detection guarantee.
- Per-request validation adds latency and load. No numeric performance claim
  is made without representative measurements.
- Session expiry, revocation, multi-login isolation, verification state, role
  boundaries, and digest primitives from B remain useful. Refresh rotation and
  JWT-specific runtime contracts/tests were retired or replaced in C3.
- Applied migrations are immutable. Schema adaptation uses new human-generated
  migrations; existing refresh credentials must not authenticate as sessions.

## Alternatives

- Browser access JWT plus refresh cookie: valid hybrid, superseded for this
  first-party flow because it exposes bearer credentials and adds renewal races.
- HttpOnly access JWT plus refresh cookie: hides the bearer from JavaScript but
  retains expiry, rotation, and revocation-window complexity.
- Redis-authoritative sessions: suitable when measured requirements justify the
  additional operational boundary; not selected for the initial implementation.

This decision revises the M04.2 authentication mechanism in ADR 0004 without
changing Platform domain ownership or Gateway's BFF responsibilities. The
basic Platform/Gateway/Web browser-session cutover was human-verified on
2026-09-27. C3 retirement was accepted by the human on 2026-10-03 after source,
contract, test/build, existing-schema migration, role, session/HTTP, and manual
browser verification. Disconnected JWT/refresh runtime code, contracts,
configuration, direct dependencies, and refresh persistence are removed.
Historical applied migrations and negative compatibility coverage remain.

`RetireRefreshTokenState1791037176093` atomically replaces the session expiry
CHECK and removes `last_refreshed_at` and `auth_refresh_token`. It requires an
active migration transaction and is forward-only: rollback cannot reconstruct
retired timestamps or credentials. Existing users and opaque-session state are
not intentionally rewritten. Empty-schema replay and direct before/after proof
of pre-retirement session preservation were not supplied for C3 acceptance;
fresh-stack rehearsal remains an F gate. This is local task acceptance, not a
production migration authorization or completion of SESSION-16.

E1 browser resilience and proven legacy-cookie cleanup were locally accepted by
the human on 2026-10-05. Separate marker/cookie Web Locks, revision-fenced
bootstrap and pre-cache transport delivery, durable logout intent and explicit
recovery preserve Platform authority without a new server protocol. Ordinary
read failure permits Retry; completed revocation failure permits explicit Retry
sign out; unknown/abandoned cookie actions require the approved manual reset.
There is no weaker lock fallback or automatic cookie-action replay.

[Browser session behavior and recovery](../browser-session.md) records the active
ownership, recovery rules and limitations. Human evidence includes `verify`,
eight live-tool checks and twenty live scenarios with successful exact cleanup.
The empty-inbox/cache-evidence and failed-persistence limits remain explicit.
This is E1 local acceptance, not full M04.2 or SESSION-16 completion.

D1 local mail transport was locally accepted by the human on 2026-10-08.
SMTP availability does not enter Platform auth readiness or session validation;
explicit Mailpit outage evidence preserves the same session before/after failed
dispatch. [Platform mail transport](../platform-mail.md) records ownership,
bounded dispatch, private capture and delivery limitations. D2-D3 registration
confirmation, E2 UI and F integrated acceptance remain separate work. D1 changes
neither the session authority nor the active registration contract.
