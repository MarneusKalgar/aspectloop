# Browser Session Behavior And Recovery

Status: M04.2 E1 locally accepted 2026-10-05; E2 browser confirmation locally accepted 2026-10-11

This documents the active first-party browser behavior under
[ADR 0005](decisions/0005-browser-session-cookie-and-platform-validation.md).
Platform/PostgreSQL remains the session authority; browser coordination only
orders work and withholds unsafe UI access. D1 local mail transport is separately
accepted. D3 registration/confirmation HTTP and E2 browser confirmation are
locally accepted and cookie-neutral. F final M04.2 integrated acceptance remains
a separate task.

## Ownership And Ordering

- `SessionCoordinatorProvider` creates one coordinator per mounted browser app,
  shared by authentication and Apollo transport. The browser environment adapts
  native Web Locks, storage events and optional BroadcastChannel notifications.
- `SessionMarkerStore` validates the versioned, at-most-1024-character
  `aspectloop.session-coordination.v1` marker. It contains only an epoch,
  logout intent, revocation category and bounded action metadata: no credential,
  user projection, password or raw error. A short marker lock protects atomic
  transitions; peer messages are hints to reread storage, not trusted state.
- `SessionCoordinator` owns revision changes and local suppression. A separate
  native cookie-action lock serializes explicit sign-in/sign-out. Lock acquisition
  and cookie requests have ten-second bounds. Queued actions recheck current
  state before dispatch; a newer logout wins over delayed login completion.
- `AuthProvider` composes bootstrap, explicit actions and presentation policy.
  Bootstrap retires Apollo cache before a no-cache `me`; only current server
  identity can produce authenticated UI. Loading/unavailable states withhold
  protected content. Cache retirement failure remains unavailable.
- The session fence link checks revision/read permission at dispatch and result,
  error and completion delivery, before Apollo cache writes. Obsolete work is
  cancelled; query deduplication is disabled so a new account cannot reuse old
  in-flight work. Sign-in/out use uncached executors under the cookie lock rather
  than the ordinary read fence. Retiring UI/cache must not release their ordering
  barrier early.

Every GraphQL request uses browser-managed cookies. There is no bearer injection,
refresh flow, automatic account-action replay, storage mutex fallback or server
session cache in the Gateway. Cancelling a browser request is not proof that its
server effect or Set-Cookie delivery was rolled back.

## Logout And Recovery

Logout suppresses the current tab immediately, attempts durable logout intent
and cache retirement, then requests server revocation only through permitted
cookie-action ordering. Acknowledged logout keeps bootstrap suppressed until a
new explicit successful sign-in. Peer tabs do not independently repeat logout.

- Ordinary validation/dependency failure offers **Retry**. It retires cache and
  revalidates through `me`; it neither rewrites cookies nor replays a mutation.
- A known-completed logout failure offers **Retry sign out**. This is explicit
  revocation recovery, not proof that the earlier revocation succeeded. New login
  remains blocked until revocation is confirmed.
- A transport failure, request timeout or abandoned pending cookie action has an
  unknown outcome. Access, automatic bootstrap, mutation replay and new login
  remain blocked across reload. Connectivity returning or elapsed time cannot
  resolve that uncertainty.
- Corrupt, deleted-after-initialization or unreadable coordination storage fails
  closed. If only a logout marker write fails, the tab keeps local suppression
  and still attempts cache retirement without dispatching sign-out. Rereading the
  unchanged valid marker does not remove that local suppression; explicit
  revocation recovery still requires a successful intent write.

For reset-required state, close all AspectLoop tabs, clear site cookies and site
storage for both the actual app and API hosts, then reopen. Clearing only the
marker is not a safe recovery. Browser reset does not confirm server revocation;
an inaccessible server session can remain valid until its existing expiry.

## Capability And Cookie Boundaries

Without native Web Locks, an unsuppressed existing session may still be read,
but sign-in/server revocation cannot be dispatched safely. Logout remains local
suppression, not confirmed server logout. Missing BroadcastChannel falls back to
storage-event hints and mandatory rereads, not a weaker lock implementation.

Durable peer/reload suppression depends on successful marker persistence. A failed
write cannot guarantee suppression in other tabs or after reopening, even though
the failing tab withholds protected UI. Do not present that outcome as confirmed
logout. Follow reset guidance before reopening when durable intent could not be
stored.

SPA startup expires only the proven JavaScript-readable, host-only historical
`aspectloop_access_token` cookie at `Path=/`, with matching HTTPS security scope.
Gateway appends its legacy tombstone only on successful sign-in or an allowed
explicit sign-out. The active HttpOnly `aspectloop_session` remains Gateway-owned
at `/graphql`; ordinary validation, failed sign-in and rejected requests do not
write cookie headers. Explicit sign-out clears the active cookie even when
revocation cannot be confirmed. No unproven historical cookie names are cleared.

## Public Registration And Confirmation

`/registration-pending` and `/confirm-email` render outside the session boundary,
including when session validation is unavailable. Signup routes to neutral
pending instructions without carrying an email or password through navigation.
The resend form starts empty; acceptance does not prove mailbox existence or
delivery. A retained `AUTH_EMAIL_UNVERIFIED` sign-in rejection offers a resend
link only for the current session epoch, even when pending sign-in remounts the
form. Other credential rejections do not acquire that link.

At fresh document startup, before asynchronous App/router/mock loading, Web
captures only a bounded, structurally valid confirmation fragment into private
memory. It removes query, fragment and history state from the confirmation URL,
including malformed links. The token does not enter React state, route state,
browser storage, Apollo cache or presentation subscriptions. This capture is
startup-only: same-document hash changes or route remounts do not capture another
link, and reloading the sanitized URL cannot restore the secret.

One private confirmation attempt survives route/StrictMode remounts. Mounting,
bootstrap and reload never consume it. An explicit click dispatches one bounded,
uncached request; overlapping clicks cannot dispatch twice. Success or invalidity
discards the token and removes the action. Unknown or rate-limited outcomes retain
it only for another explicit click, with no automatic replay. Confirmation never
logs in, rewrites a cookie or replaces an unrelated authenticated account.

Resend also uses an explicit bounded, uncached request and safe closed feedback.
Its 60-second local wait and bounded supported `retryAfterMs` countdown are UI
affordances, not server cooldown authority or delivery guarantees. The countdown
uses wall-clock time and releases its interval on expiry/unmount. Public
confirmation/resend commands do not consume or publish a browser session
generation; existing cookie-action ordering remains unchanged. A verified user
must sign in separately before accessing protected content.

## Accepted Evidence And Limits

The human accepted E1 on 2026-10-05 after `verify` (54 Web unit tests and 11
integration tests), eight live-tool/privacy tests, all twenty live scenarios,
successful exact fixture cleanup and recovery-wording acceptance. Earlier
backend/build/mock-browser results are recorded separately in the working plan;
none of these results are agent-run verification.

The live suite proves real shared-cookie ordering, current identity delivery and
retirement/cancellation of product work. Its empty correction inbox does not
prove deletion of distinguishable account-owned product records; focused
unit/integration cache-fencing evidence complements it. Injected capability
faults are not broad unsupported-browser compatibility certification. Fresh-stack
rehearsal, stage/performance evidence and the complete SESSION matrix remain with
F. Prepared registration state and sign-in identity limits are locally verified
by human report on 2026-10-10. D3 HTTP activation and its real email/HTTP verifier
are also locally accepted: registration, resend and confirmation successes and
rejections preserve an unrelated existing session and never write cookie headers.
Only explicit verified sign-in grants a new session. E2 was locally accepted on
2026-10-11 after the current human-run repository checks, ten mock auth browser
cases, nineteen live-tool/privacy checks and the full twenty E1 plus one E2 live
matrix with exact cleanup. The genuine local mail-to-browser flow includes
Platform outage, explicit retry after restoration, verified sign-in, reused-link
rejection preserving the current session and acknowledged sign-out. See
[E2 testing evidence](testing-strategy.md#88-accepted-e2-browser-confirmation-verification).
See [Platform registration](platform-registration.md) for scope and limits.
D1 local mail transport was
accepted on 2026-10-08 with session/readiness independence from Mailpit outage;
see [Platform mail transport](platform-mail.md) for its evidence and limitations.

See [testing strategy](testing-strategy.md) for suite ownership and the
[live suite runbook](../apps/web/test/e2e-live/README.md) for prerequisites,
exclusive local-service ownership, private fixtures and failure-stage reporting.
