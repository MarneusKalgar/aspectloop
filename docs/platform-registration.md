# Platform Registration State And Identity Limits

Status: M04.2 D2 locally verified by human report, 2026-10-10; D3 HTTP activation and E2 UI pending

D2 prepares generic signup, resend and email-confirmation commands in Platform,
and activates identity limiting on the existing Platform sign-in path. It does
not activate public/private registration routes or change the existing live
signup response. D3 must migrate the producers and their callers together;
E2 owns the explicit browser confirmation flow. No schema, grant, migration or
GraphQL SDL change is introduced by D2.

## Ownership And Transactions

`apps/platform-service/src/auth/registration/` owns the command orchestration,
transaction store, typed input validation and fixed confirmation-message builder.
It reuses the existing password and purpose-separated opaque-credential services,
contracts, request parser and [D1 mail port](platform-mail.md). The SMTP adapter
does not own registration policy or token rendering.

- Prepared signup/resend accepts one deliverable bare mailbox with a
  254-character bound, normalized before admission. Password bytes are preserved.
  Existing live identity contracts retain their compatibility bounds until D3.
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
- Prepared signup/resend shares three attempts per normalized email per hour.
  Every admitted structurally valid request consumes an attempt before expensive
  work, including unknown/verified identities, cooldown and database failure;
  there are no refunds. Threshold/capacity suppression remains generic.

Restart loses these counters, not the PostgreSQL cooldown. This is not a
distributed or cross-replica rate limit.

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
reported all checks passing on 2026-10-10 after the helper/lint follow-up; individual
outputs, counts and timings were not supplied. See
[testing strategy](testing-strategy.md#86-d2-prepared-registration-verification)
for the reported handoff commands. No agent-run or CI verification is implied.

Mail remains bounded and best-effort, with no durable outbox or external mailbox
delivery guarantee. Terminal-history retention maintenance, distributed limits,
external-provider delivery and stage/performance certification are not proved by
this gate. D3 retains coordinated HTTP activation and its real email/HTTP verifier;
E2 retains browser UX; F retains fresh-stack and integrated SESSION acceptance.
