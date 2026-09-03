# M04-B Garage Compatibility Spike

Accepted M04-B compatibility spike (2026-08-31). Disposable infrastructure for
[ADR 0003](../../../../docs/decisions/0003-local-s3-and-recovery-boundary.md).
It runs locally or in the separate branch-scoped PR workflow, not as part of
`local:up`, required CI checks, or `verify:full`. It does not access PostgreSQL,
RabbitMQ, the persistence mock, or application environment files. No application
adapter or backup command is delivered here. Native arm64 and amd64 results,
run links, and acceptance limits are recorded in ADR 0003.

## Prerequisites

Use the repository's Node/npm versions and a **local** Docker Engine/Desktop
with Compose v2. Ports `127.0.0.1:43900` and `127.0.0.1:43903` must be free.
Do not use a production/remote Docker context. The fixed project is
`aspectloop_m04b_garage`; its only volumes are `metadata` and `objects`, prefixed
with that project name. RPC is not published. The Admin API is loopback-only
and no admin token is configured; bootstrap uses the native CLI over RPC.

The unmodified scratch image runs as its default root user, with all Linux
capabilities dropped, privilege escalation disabled, and a read-only root
filesystem. Only the two disposable volumes are writable. This is a local
spike posture, not a production hardening claim.

The accepted lockfile includes both root dev dependencies at `3.1112.0`.
For a fresh checkout, install and inspect that locked baseline from the
repository root:

```bash
npm ci
npm ls @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
git diff -- package.json package-lock.json
```

Dependency changes and lockfile regeneration remain human-owned. These SDK
packages are used only by the spike, not gateway production code. Keep future
manifest changes paired with the reviewed lockfile. M04-F will declare the
actual application's SDK dependency in its owning workspace.

Review the publisher, release source, license, and manifest without starting it:

```bash
docker buildx imagetools inspect dxflrs/garage:v2.3.0
```

Expected index digest and arm64/amd64 child digests are recorded in ADR 0003.
The Compose file uses the immutable index even if the upstream tag later moves.
Investigate any discrepancy; do not silently replace the pin.

## First Run And Restart

```bash
npm run local:garage:spike -- init
npm run local:garage:spike -- up
npm run local:garage:spike -- bootstrap
npm run local:garage:spike -- bootstrap
npm run local:garage:spike -- verify-empty
npm run local:garage:spike -- verify
npm run local:garage:spike -- restart
```

`init` creates ignored, mode-0600 `.env.local` beside this README with random
RPC and S3 credentials. It preserves an existing file. Never reuse these
credentials elsewhere or print/share the file or rendered Compose configuration.
The image is pulled when needed; no custom image build is required.

Expected signals:

- `up`: bounded native `/garage status` succeeds. Host `/health` status is
  printed before bootstrap; it is not interpreted as bucket readiness.
- `bootstrap` twice: exactly one connected node, layout v1 with 1 GB assigned
  capacity in zone `local`, the same imported key, and two private buckets.
  The second run creates no replacement key or new layout version. This is
  test capacity accounting, not a disk reservation or quota.
- `verify-empty`: post-bootstrap `/health` is 200; structured cluster health is
  healthy; authenticated `HeadBucket` succeeds and an existing ungranted
  bucket returns 403. The source bucket lists no objects.
- `verify`: `PutObject`, `HeadObject`, `GetObject`, content type, custom metadata,
  size, SHA-256, and presigned PUT/GET pass. Anonymous object access returns 403. Metadata and content type are included in the presigned PUT request.
- `restart`: the same key and objects work after a normal restart. This is a
  **read-only object check**, so lost objects cannot be hidden by recreating
  the fixture. The final output is `PASS: read` with the selected architecture.

`verify` intentionally overwrites two fixed synthetic fixture keys; it is not
an application write-once test. Presigned URLs and credentials never appear in
probe output. URLs expire after 60 seconds, but expiry/tampering/CORS tests are
not part of this spike. There is no browser-facing upload API.

## Reset Proof

This deletion applies **only to the fixed disposable spike project**, never to
the normal local stack. It requires an explicit confirmation flag:

```bash
npm run local:garage:spike -- reset --confirm-disposable
npm run local:garage:spike -- up
npm run local:garage:spike -- bootstrap
npm run local:garage:spike -- verify-empty
npm run local:garage:spike -- verify
npm run local:garage:spike -- restart
npm run local:garage:spike -- down
```

Expected: the old objects are gone, bootstrap recreates layout/buckets/grants,
the empty check passes **before** any writes, and fresh read/write/restart
checks pass. The node's internal ID may change; it is not application identity.
Reset keeps the ignored credential file for deterministic re-import; deleting
volumes is not a backup or a restore test.

`down` preserves volumes. To clean them after acceptance, run the confirmed
reset again. Do not use the unrelated `npm run local:reset` for this spike.

## Architecture Gate

Run the full sequence on the host's native Docker architecture. For the other
supported architecture, prefer a native machine. Docker Desktop emulation can
provide additional evidence; label it as emulated, not native. Stop/reset the
spike before changing architecture because the embedded metadata database
must not be reused as an architecture-migration experiment.

The accepted results are native arm64 on Apple Silicon Docker Desktop and
native amd64 on GitHub-hosted Ubuntu. The Mac's emulated amd64 startup failed,
including after a disposable-volume reset; its initial logs reported LMDB
`Function not implemented (os error 38)`. Emulation is not an accepted runtime
path. Use the native-amd64 PR job below for that architecture instead of
repeating the failing Mac sequence. A regression on a supported native
architecture or in the required S3 subset requires provider review.

If startup fails while opening LMDB, confirm the attempt used fresh spike
volumes and inspect the stopped container's logs locally. A failure under
emulation does not establish a failure on native amd64. Keep that distinction
in the verification record; do not change the database engine or weaken
container security simply to obtain a passing architecture result.

### Native amd64 PR Verification

`.github/workflows/m04b-garage-spike.yml` runs on pull requests targeting `main`
whose source is the same repository's `M04B-garage-compatibility-spike` branch.
It can run before this workflow is merged. Opening/reopening the PR or pushing
another commit to its source branch triggers the workflow; no manual dispatch
or default-branch workflow installation is required.

The `Garage Native amd64` job uses `ubuntu-24.04`, asserts native amd64 for the
host and Docker engine, and checks the selected image architecture. It reuses
the pinned Compose image, LMDB configuration, and probe without an emulator.
It installs the lockfile with the repository's exact Node/npm contract, creates
runner-local disposable credentials, and runs bootstrap twice, empty-before-write
verification, S3 checks, read-only restart verification, and the full reset drill.
An always-run cleanup step removes only the fixed spike containers and volumes
after initialization; runner disposal also isolates interrupted jobs.

For a rerun while this branch-specific workflow is retained, push the reviewed
changes to this branch and open/update its PR into `main`. Inspect the separate
`M04-B Garage Spike` workflow and require every verification and cleanup step
to pass. Record the run URL and tested PR merge commit from its job summary.
The workflow is not part of `All Checks Passed` or `verify:full`; a passing run
provides native-amd64 evidence, not automatic acceptance of later changes.
No application secrets, credential artifacts, or raw request logs are uploaded.
Retire or deliberately rescope this branch-specific workflow after the spike.

## Repository Checks And Evidence

For future spike changes, the human formats/lints the affected files, then runs
the repository gate:

```bash
npm exec -- prettier --write package.json .github/workflows/m04b-garage-spike.yml infra/local/spikes/garage docs/data-and-recovery.md docs/decisions/0003-local-s3-and-recovery-boundary.md
npm exec -- eslint infra/local/spikes/garage/*.mjs --fix
npm run deps:policy
npm run docker:policy
npm run verify:full
git diff --check
```

Record platform/native-or-emulated mode, Docker/Compose and Node/npm versions,
image digests, installed SDK versions, PASS lines, pre/post-bootstrap health
status, idempotent bootstrap, restart, reset, and repository check outcomes in
the working milestone plan. Acceptance of future provider/dependency changes
requires renewed relevant checks and human review; the current M04-B baseline
and recovery-boundary/source/license review were accepted on 2026-08-31.

Failures report only the bounded step and error class to avoid leaking SDK
requests, signed URLs, or secrets. Check missing dependencies, local Docker
context, port conflicts, image availability, and the named project in Docker
Desktop. Do not share container inspection/environment dumps. Unexpected
layout/config drift is a stop signal, not permission to reset arbitrary data.

The baseline runtime and repository checks passed; the agent did not run them.
Manifest/source inspection is not a substitute for rerunning the relevant
checks when the accepted baseline changes.
