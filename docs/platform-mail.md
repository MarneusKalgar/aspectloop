# Platform Mail Transport

Status: M04.2 D1 locally accepted by the human, 2026-10-08

Platform owns the provider-neutral mail port, bounded in-memory dispatcher,
SMTP adapter, and configuration. Gateway and Web do not own or import SMTP
mechanics. D1 provides transport infrastructure and private synthetic-message
verification, not registration delivery or public confirmation commands.
Registration message/link construction and post-commit enqueue belong to D2;
coordinated HTTP activation belongs to D3 and confirmation UI to E2.

## Ownership

The feature lives under `apps/platform-service/src/mail/`:

- `mail.port.ts` defines the injection token, frozen admission/outcome/limit
  constants, and provider-neutral contracts. `mail.module.ts` wires the provider.
- `dispatch/` owns admission, queue capacity, worker deadlines, and shutdown.
- `message/` owns bare-mailbox and bounded plain-text validation.
- `smtp/` owns the transport, one-attempt coordinator, physical resource owner,
  MIME composition, and SMTP-specific limits.

The installed Nodemailer dependency supplies the SMTP/MIME implementation.
Each attempt owns its socket, SMTP connection, and MIME stream; there is no
provider pool or hidden retry queue. Teardown detaches active callbacks and
physically destroys resources. Temporary late-error guards are removed on close.
Provider-close and diagnostic-observer failures retain only bounded boolean
evidence, never raw errors or message content.

## Admission And Lifecycle

The dispatcher permits two active attempts and at most 100 waiting messages.
Each active worker has a five-second deadline starting at dispatch, not enqueue;
connection/greeting/socket phase bounds are 1.5 seconds. Cancellation closes the
underlying attempt before another worker starts. If the transport violates its
cancellation contract, the dispatcher stops admission and remaining work rather
than risk exceeding physical concurrency limits.

Admission returns immediately with `queued`, `queue-full`, `invalid-message`,
or `stopped`. Admitted messages have a private, non-rejecting completion promise
with `sent`, `smtp-failed`, `timeout`, or `stopped`. Registration callers must
enqueue only after transaction commit and must not await recipient-specific
completion in their HTTP response; D1 has not activated those callers.

Only one bare recipient mailbox and the configured bare sender are permitted,
with a shared 254-character mailbox bound. Subject is nonempty, rejects ASCII
control characters/DEL, and is at most 200 UTF-8 bytes. Text rejects NUL and is
at most 16,384 UTF-8 bytes. Arbitrary headers, attachments, file access, and URL
fetching are not enabled. SMTP response size is independently bounded to 16,384
bytes. Logs use fixed categories without recipients, raw messages, credentials,
confirmation URLs, or provider error bodies.

Settlement clears timers and message/attempt references. Shutdown stops
admission, cancels active attempts, and discards waiting mail. There is no durable
outbox, restart persistence, automatic retry, or delivery guarantee. `sent`
means SMTP acknowledgement, not delivery to an external mailbox; an interrupted
acknowledgement can leave an uncertain remote outcome.

## Configuration And Local Capture

Platform validates `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, optional
paired `SMTP_USER`/`SMTP_PASSWORD`, and `WEB_PUBLIC_BASE_URL`. Malformed ports or
booleans, unpaired/empty credentials, and unsafe sender values fail validation
without echoing their contents. Authenticated SMTP requires implicit TLS or
STARTTLS, with certificate validation enabled. `WEB_PUBLIC_BASE_URL` is a
configured HTTP(S) origin without userinfo, query, fragment, or non-root path;
confirmation-link construction is not yet active.

The local stack uses Mailpit v1.31.4 pinned to image index
`sha256:b68349e3a014b90c5610bfb26b2ae36f3892d7b8cf25ee140c6c71c98d2fcf48`.
SMTP at `mailpit:1025` is Compose-private with no host publication. Only the UI
binds to `127.0.0.1:8025`. Capture storage is ephemeral, bounded tmpfs, with a
500-message cap. `local:up` waits for Mailpit startup, but Platform auth readiness
and session validation do not probe or depend on SMTP availability.

## Private Verification

Use the initialized default local stack and ignored local environment files:

```sh
npm run local:up
npm run local:auth:verify -- --mail
```

Expect exit zero and `D1-MAIL-CAPTURE passed`. The tool sends synthetic text with
no confirmation credential, verifies its captured sender/content, and removes
only run-owned messages by explicit recorded IDs. An empty ID set never issues
a deletion request. Capture requests use fixed private routes, bounded replies,
no redirects, and fixed safe output. Owned account/session fixtures are cleaned
by the existing private HTTP verifier. Missing capture fails rather than skips.

Reserve exclusive local-service ownership for the outage sequence. Stop only
Mailpit; do not reset volumes or stop Platform/the full stack:

```sh
bash -c 'source infra/local/scripts/_local-compose-common.sh && "${COMPOSE[@]}" stop mailpit'
npm run local:auth:verify -- --mail-outage

# Expected failure: nonzero exit, not a skip.
npm run local:auth:verify -- --mail
```

The outage mode requires unavailable capture and an SMTP failure/timeout. Expect
`D1-MAIL-SESSION-12 passed` and exit zero: the same session's `me`, protected
correction inbox, and Platform readiness succeed before and after failed
dispatch. The session is established while Mailpit is already stopped; this
does not prove preservation across an in-flight SMTP restart.

Always restore Mailpit, including after an unexpected failure:

```sh
bash -c 'source infra/local/scripts/_local-compose-common.sh && "${COMPOSE[@]}" up -d --wait --wait-timeout 120 mailpit'
npm run local:auth:verify -- --mail
npm run local:auth:verify -- --sessions
npm run local:auth:verify -- --http
```

All restored commands must exit zero. See [testing strategy](testing-strategy.md)
for accepted evidence. External authenticated SMTP delivery, registration/email
confirmation, stage/performance evidence, and full M04.2 integrated acceptance
are not established by D1's local gate.
