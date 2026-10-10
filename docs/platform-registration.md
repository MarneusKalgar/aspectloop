# Platform Registration State And Identity Limits

Status: M04.2 D2/D3 locally accepted by human verification, 2026-10-10; E2 UI pending

D2 supplies generic signup, resend and email-confirmation state in Platform,
with identity limiting on sign-in. D3 activates the private/public commands and
their shared contracts and signup callers together. E2 still owns the browser
confirmation route, pending/resend screens and explicit email-to-login journey.
D3 reuses D2 persistence without a new migration, grant or dependency.

## Ownership And Transactions

`apps/platform-service/src/auth/registration/` owns the command orchestration,
transaction store, typed input validation and fixed confirmation-message builder.
It reuses the existing password and purpose-separated opaque-credential services,
contracts, request parser and [D1 mail port](platform-mail.md). The SMTP adapter
does not own registration policy or token rendering.

- Active signup/resend accepts one deliverable bare mailbox with a
  254-character bound, normalized before admission. Password bytes are preserved.
  Sign-in retains its existing 320-character identity compatibility bound.
- Hashing occurs outside the transaction. Conflict-safe account insertion and
  user-row locks prevent duplicate signup from replacing an existing password
  or profile. Eligible token transitions use the existing bounded auth lock wait.
- Token replacement terminates the prior current token before inserting its
  successor, including an expired but unterminated token. Only the
  purpose-separated HMAC digest is persisted; the raw credential is private
  transient mail work.
- Creation and expiry share the insert's database statement timestamp and the
  configured TTL. Consumption and durable 60-second issuance cooldown use the
  database clock; terminal issuance history retains cooldown across process
  restarts. User verification and token consumption commit atomically, with
  exactly one successful consume under contention.
- Invalid token strings receive the same fixed confirmation error. Structural
  request failures use fixed bad-request responses without parser diagnostics.
  Registration and confirmation neither issue a session nor revoke existing ones.
- Only committed mail work is synchronously enqueued. Commands do not await
  private delivery completion. Fixed plain text links to the configured Web
  origin at `/confirm-email#token=...`; no recipient/profile interpolation enters
  the message body. Suppressed signup/resend outcomes remain generic.

## Identity Limits

`auth/limits/` owns timer-free process-local counters, separate from Gateway IP
limits. Each identity map has a 10,000-key capacity bound. Windows are fixed and
anchored at first admission:

- Sign-in permits five failed/pending checks per normalized email per 15 minutes.
  Reservations precede user lookup and password verification, including unknown
  identities. Correct password verification resets the current accounting
  generation, including unverified credentials; unverified login remains denied.
  Older pending checks retain physical capacity until settlement but cannot
  change a successor generation. Database failures release reservations without
  counting as credential failures. Threshold/capacity rejection has bounded
  integer `retryAfterMs` metadata in 1..3600000.
- Signup/resend shares three attempts per normalized email per hour.
  Every admitted structurally valid request consumes an attempt before expensive
  work, including unknown/verified identities, cooldown and database failure;
  there are no refunds. Threshold/capacity suppression remains generic.

Restart loses these counters, not the PostgreSQL cooldown. This is not a
distributed or cross-replica rate limit.

## Active HTTP And Browser Caller Boundary

Gateway's `PlatformClient` owns registration transport; the separate browser-
session client remains responsible for session commands. Platform owns all
registration policy and state. Public commands are accessible without a session
but retain exact-Origin/JSON-POST protection, no-store, batch rejection and
Gateway socket-IP limits. Sign-in/out sole-root rules remain unchanged.

| Public mutation           | Private Platform POST route                   | Result                                                              |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `signUp`                  | `/internal/v1/auth/sign-up`                   | Generic acceptance; public `success: true`, deprecated `user: null` |
| `resendEmailConfirmation` | `/internal/v1/auth/resend-email-confirmation` | Generic `success: true`                                             |
| `confirmEmail`            | `/internal/v1/auth/confirm-email`             | `success: true` only after atomic consume                           |

Private success envelopes contain only `success: true`; no user, token or mail
receipt is projected. Signup/resend acceptance is not proof of account creation
or delivery. Duplicate signup, unknown resend, verified, cooldown and identity-suppressed
outcomes do not disclose existence or replace an existing password/profile.
Genuine database/transport failures remain dependency failures, not acceptance.

Empty, oversized (over 128 characters), malformed, used or replaced confirmation
strings receive `AUTH_CONFIRMATION_INVALID`. Structural failures remain safe
validation rejections. The existing strict auth error policy rejects malformed
upstream envelopes and unsupported codes as dependency unavailable; no parser
or provider diagnostics are exposed. A GraphQL pre-execution rejection may use
HTTP 200 with an errors-only envelope; HTTP status alone is not operation success.

None of these commands sets/clears a cookie, signs in, revokes an existing session
or grants product access. A newly registered user remains unverified; correct
credentials return `AUTH_EMAIL_UNVERIFIED` until confirmation. Verified sign-in
must still be explicit. Gateway IP windows are process-local: signup/resend share
20 attempts/hour, confirmation permits 10/minute, and sign-in permits 30/15 minutes.
IP exhaustion returns bounded `AUTH_RATE_LIMITED` metadata, distinct from generic
Platform registration-identity suppression.

Web signup requests success only and uses neutral instructions to check email
before sign-in. Validation preserves exact password bytes and uses the active
254-character signup bound. MSW mirrors generic duplicates and unverified new
accounts while retaining its verified default reviewer. Linked CommonJS contracts
are explicitly optimized by Vite; this does not migrate the shared package format.
The emailed `/confirm-email#token=...` link construction is active, but browser
fragment handling, confirmation/resend UI and its live acceptance remain E2.

## Local Verification And Retained Limits

With the initialized default local stack and healthy Mailpit, the human runs:

```sh
npm run local:auth:verify -- --registration --build
```

This is production-provider integration against real PostgreSQL runtime roles
and SMTP/Mailpit, not HTTP or browser E2E. D2-REG-01 through D2-REG-09 cover
creation/duplicate preservation, token validation/consumption, both replacement
race orderings, rollback/purpose isolation, durable cooldown, bounded lock failure,
live sign-in limiting, cleanup after post-commit faults and independent sessions.
Queue-full/stopped/SMTP-failure cases use controlled D1 receipts with real
transactions; they are not additional real SMTP-outage evidence.

The verifier prints passing groups only after exact owned database and capture
cleanup succeeds. It uses separate cleanup privileges, never delete-all capture,
and fixed output without credentials, mail bodies or raw diagnostics. The human
reported all D2 checks passing on 2026-10-10 after the helper/lint follow-up; individual
outputs, counts and timings were not supplied. See
[testing strategy](testing-strategy.md#86-d2-prepared-registration-verification)
for the reported handoff commands. No agent-run or CI verification is implied.

For D3, reserve exclusive local auth traffic with matching validated runtime/tool
configuration and healthy Gateway, Platform, PostgreSQL and Mailpit. Reset only
process-local counters before an email run or no-mode aggregate:

```sh
bash -c 'source infra/local/scripts/_local-compose-common.sh && "${COMPOSE[@]}" restart platform-service gateway-api && "${COMPOSE[@]}" up -d --wait --wait-timeout 120 platform-service gateway-api'
```

Then choose one command; repeat the reset before another run:

```sh
# Focused real registration HTTP/email verification.
npm run local:auth:verify -- --email --build
# Or the fail-fast sessions -> HTTP -> email aggregate.
npm run local:auth:verify -- --build
```

The email group deliberately exhausts IP windows. No throttle bypass, automatic
counter reset or implicit Mailpit startup is built into the verifier. `--build`
rebuilds the verifier image, not running runtime containers; source changes to
Gateway/Platform require their separate rebuild/recreation before acceptance.
Unavailable prerequisites fail, never skip; unknown/conflicting modes exit 2.

Human screenshots show focused and aggregate D3-EMAIL-01 through 07 passing,
including generic results, actual owned mail capture, digest-only persistence,
explicit replacement/consume/login/logout, validation and real lock failure,
Origin/batch restrictions, identity/IP thresholds and original-session/cookie
preservation. Final success follows exact owned database/mail cleanup and pool
closure. The human separately confirmed all generation, quality, backend/Web
test, build and applicable browser checks passed on 2026-10-10. No exact fresh
test counts, CI/publication or agent-run verification are claimed. See
[D3 testing evidence](testing-strategy.md#87-accepted-d3-http-and-email-verification).

Mail remains bounded and best-effort, with no durable outbox or external mailbox
delivery guarantee. Terminal-history retention maintenance, distributed limits,
external-provider delivery and stage/performance certification are not proved by
these gates. The HTTP verifier permits the accepted SMTP worker/phase bound to
settle ambiguous local completions before exact cleanup; this exclusive-local
assumption is not a guarantee against externally queued late delivery. E2 retains
browser UX; F retains fresh-stack and integrated SESSION acceptance.
