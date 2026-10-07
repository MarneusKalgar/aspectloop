# E1 live session verification

Status: E1 locally accepted by the human, 2026-10-05; full live matrix 20/20 and
exact fixture cleanup passed. Canonical behavior is in
[browser session recovery](../../../../docs/browser-session.md).

This local-only suite exercises the committed browser runtime against the real
Gateway, Platform and database. It is separate from mock E2E, `verify`,
`verify:full` and CI. It adds no dependency or production fault switch.

`support/live-topology.ts` is the single fixed local topology definition used by
the Web launcher, forwarding gate, readiness/CORS probes and cookie assertions.
The origin deliberately is not an arbitrary environment override: the approved
Gateway CORS/CSRF boundary and exclusive local-service ownership are unchanged.
Different origins/backends require a separately reviewed configuration change.

Gate responsibilities are separate: `response-gate.ts` owns listener/holds and
overlap accounting; `gate-operations.ts` validates/reads requests;
`forward-response.ts` owns upstream transport and original response delivery;
`held-response.ts` owns bounded barriers; `response-observation.ts` extracts only
safe metadata. Local tool implementation/types are colocated under `support/`;
root `scripts/e2e/` retains only orchestration and focused tool tests.

## Human prerequisites and command

Use the repository Node/npm runtime. Prepare the existing stack, built shared
packages, installed Chromium shell and applied migrations through the usual
human-owned workflow. The runner does not install, build, migrate, seed or reset.
Stop the Web dev server on `localhost:5173`; ports 5173 and 18080 must be free.
Keep the normal Gateway port 8080 and exact credentialed CORS allowlist for
`http://localhost:5173`. A missing prerequisite fails, never skips as success.

Reserve an exclusive local verification window with no other account traffic.
The full suite makes fewer than 30 sign-in attempts; pre-existing Gateway IP
limiter traffic can require waiting for its 15-minute window before a rerun.
Do not increase/reset production limits to obtain a pass.

```bash
npm run test:e2e:live -- --allow-platform-outage
```

The flag explicitly permits stopping/restoring the exact local Platform service
for real upstream-failure cases. No flag means no run or service stop. Remote
Docker contexts and CI are rejected. The runner owns its Vite process, temporary
metadata/artifact directory and browser contexts, not a human browser profile.

Run the new focused tool/input checks and repository compatibility gates too:

```bash
# Formatting/fixes remain human-owned; these paths are limited to the amendment.
npm exec -- prettier --write "apps/web/test/e2e-live/**/*.{ts,md,json,mjs,mts}" apps/web/playwright.live.config.ts "scripts/e2e/*.{mjs,mts}" apps/platform-service/src/db/verify/auth-http/fixture.ts apps/platform-service/src/db/verify/auth-http/private-fixture-input.ts apps/platform-service/src/db/verify/platform-auth-http.ts apps/platform-service/test/auth/private-fixture-input.test.ts apps/web/package.json apps/web/tsconfig.node.json apps/web/tsconfig.playwright.json eslint.config.mjs package.json
npm exec -- eslint --fix apps/web/test/e2e-live apps/web/playwright.live.config.ts scripts/e2e apps/platform-service/src/db/verify/auth-http/fixture.ts apps/platform-service/src/db/verify/auth-http/private-fixture-input.ts apps/platform-service/src/db/verify/platform-auth-http.ts apps/platform-service/test/auth/private-fixture-input.test.ts
npm run test:e2e:live:tools
npm run test:backend:run -- apps/platform-service/test/auth/private-fixture-input.test.ts
npm run type-check
npm run lint:ci
npm run format:check
npm run graphql:check
npm run test:e2e:mock -- test/e2e/auth
```

## Evidence and privacy

Twenty scenarios cover E1-LIVE-01 through 09, with named subcases for native
locks, storage/capability faults, owner closure, timeouts and delayed errors.
Each gets a fresh context; cross-tab scenarios share two pages in that context.
One worker, zero retries, stop after the first failure. Unexecuted scenarios are
pending evidence, not passes. The parent fails on any run or cleanup failure.
Expected complete evidence is `E1-LIVE-COUNTS passed=20 required=20 pending=0`,
`E1-LIVE-SUMMARY passed`, successful exact cleanup and exit status zero. These
remain required for future runs. The human supplied the full passing matrix and
successful exact cleanup for E1 acceptance; the agent has not executed the suite.

The Node forwarding gate uses no cookie jar and forwards only four fixed
operations to the local Gateway. It holds complete genuine response headers and
body, including separate Set-Cookie headers. Receipt, delivery and cancellation
are explicit barriers. Browser route aborts model only browser-to-Gateway faults;
the Platform cases stop the actual upstream service. No auth payload is fabricated,
no mutation replay is added and application fetch/coordinator code stays real.

Two verified fixtures use production hashing/runtime privileges. Passwords exist
only in worker/browser memory and a private stdin pipe. Only exact UUID metadata
is returned. Parent-owned cleanup joins an interrupted creation job before exact
user/session cleanup. Cleanup runs after failure and handled interruption too.
SIGKILL/machine loss can still require the printed exact-ID recovery commands;
also restore Platform and close any surviving run-owned Web process before rerun.
Do not delete broad tables, reset the stack or clear a human browser profile.

Live traces, HAR, video, storage-state exports, screenshots and DOM error snapshots
are disabled. Failures are sanitized before artifact handling, and the terminal
boundary emits scenario IDs/statuses, closed cookie-stage labels and safe cleanup
metadata. The focused tool check guards the inspected installed Playwright privacy
switches. Upgrades that invalidate them need review, not a rule suppression or
diagnostic capture.

Cookie scenario `E1-LIVE-09` also emits a fixed failure-stage record, for example
`E1-LIVE-09-STAGE LEGACY_CLEANUP failed`. Its ten allowlisted labels distinguish
bootstrap, SPA cleanup, rejected login/cookies, successful login, ordinary reads,
logout/cookies and each Gateway header check. Successful steps, raw step titles,
error fields, selectors and private values are not printed. The same closed
output policy validates labels in both the reporter and the parent launcher.
Legacy cleanup uses bounded boolean polling so navigation completion is not
mistaken for completion of the mounted React cleanup effect. Stage records do
not add scenarios or alter the twenty-case acceptance requirement.

The empty inbox proves identity retirement, cancelled real product transport and
independent current requests, not deletion of distinguishable A-owned product
records. Retain the committed focused cache-fencing unit/integration evidence.
Injected missing capabilities are not broad unsupported-browser compatibility.
Failed marker writes cannot guarantee peer/reload suppression; the suite expressly
checks that limitation. Unknown outcomes stay reset-required; context disposal
does not prove server revocation. Existing real HTTP checks supply the remainder
of the cookie matrix, including failed sign-in with an already-active cookie.
The lock-timeout case checks bounded rejection, an alert and zero dispatch, not
the exact busy-message wording: current error selection may expose the native
abort wording through its cause. Include that wording in the human UX review;
this verification amendment does not change the production error-selection policy.

The human accepted E1 after the results/cleanup and recovery-wording review on
2026-10-05. Retain the distinction between ordinary Retry, completed-failure Retry
sign out and reset-required guidance in future changes. This accepts E1 only;
D1-D3/E2 remain unstarted and F retains final integrated acceptance.
