# 0003 Local S3 And Recovery Boundary

Status: Proposed implementation; human M04-B acceptance pending  
Date: 2026-08-31

## Context

AspectLoop needs private object storage alongside service-owned relational
state. The current HTTP persistence mock is a mutable JSON document store,
not an S3 API and not a source-file archive. M04-B establishes the provider
boundary and a disposable compatibility spike. It does not replace the mock,
upgrade PostgreSQL, or add Garage to the normal application stack.

## Decision

Use Garage for local S3-compatible storage, subject to the human spike gates
below. Keep application access behind an S3 port, implemented first in the
gateway in M04-F using AWS SDK v3. Garage CLI/Admin APIs belong only to
infrastructure bootstrap and operations. Shared storage code requires a real
second consumer, not a speculative package.

### Reviewed Image

The official [release index](https://garagehq.deuxfleurs.fr/_releases.html)
lists v2.3.0, released 2026-04-16. The
[upstream image](https://hub.docker.com/r/dxflrs/garage) is published by
Association Deuxfleurs. The selected image is pinned in
[`compose.yml`](../../infra/local/spikes/garage/compose.yml):

```text
dxflrs/garage:v2.3.0@sha256:866bd13ed2038ba7e7190e840482bc27234c4afaf77be8cfa439ae088c1e4690
```

Read-only registry inspection on 2026-08-31 returned these platform manifests:

| Platform      | Manifest SHA-256                                                   |
| ------------- | ------------------------------------------------------------------ |
| `linux/arm64` | `2d3f94a89a8a02dc49fa75594d6df67ed9c6ffe08fe55ed023d0c9776f71a9bd` |
| `linux/amd64` | `dac0c92add4f1a0b41035e94b41036a270ffbe88a37c7ac9c3f19e6dc5bdccf2` |

These cover Docker Desktop on Apple Silicon and Intel Macs, and Linux
amd64/arm64 engines. The index also contains 386/arm images, which are not
AspectLoop's verification targets. Manifest availability is not execution
evidence on either architecture.

Source: [v2.3.0 tag](https://git.deuxfleurs.fr/Deuxfleurs/garage/src/tag/v2.3.0).
License: `AGPL-3.0`, as declared in the
[release crate metadata](https://git.deuxfleurs.fr/Deuxfleurs/garage/src/tag/v2.3.0/src/garage/Cargo.toml).
The [upstream Dockerfile](https://git.deuxfleurs.fr/Deuxfleurs/garage/src/tag/v2.3.0/Dockerfile)
uses a scratch image containing the Garage binary. Do not assume a shell,
curl, wget, or package manager exists in it.

This records publisher, source tag, license metadata, and registry content
digests. It is not a claim of independently verified build reproducibility,
signature/attestation verification, vulnerability clearance, or license approval
for future redistribution. Human source/license review remains a merge gate.

### Portable Subset

The application contract is deliberately narrower than
[Garage's advertised S3 surface](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/):

- SigV4, private buckets, path-style requests, explicit region and endpoint.
- Authenticated `HeadBucket`, `PutObject`, `GetObject`, and `HeadObject`.
- Content type, byte length, and custom metadata round-trip.
- Application-computed SHA-256 stored in PostgreSQL and object metadata;
  downloaded bytes are independently hashed. ETag is not the checksum.
- Presigned GET and PUT compatibility, with the final client-reachable host
  signed unchanged. Browser CORS, upload policy, expiry enforcement, and public
  API design still require M07 verification.

`ListObjectsV2` is used by the spike's empty-target check. Portable object
export/import, pagination, large files, streaming, and multipart behavior
remain separate M04-F/M04-H gates, not implied by the small fixture.

The probe explicitly sets SDK `requestChecksumCalculation` and
`responseChecksumValidation` to `WHEN_REQUIRED`; it does not depend on optional
AWS checksum/trailer defaults. Application SHA-256 verification remains
mandatory. See [AWS's SDK checksum guidance](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-checksums.html).

Do not depend on bucket versioning, object lock/WORM, AWS IAM policy or ACL
syntax, prefix-scoped credentials, event notifications, or provider-specific
ETag semantics. Local permissions are per key/per bucket. Application
write-once behavior is an M04-F responsibility, not a Garage retention or
atomic conditional-write guarantee. The spike may overwrite only its fixed
synthetic fixtures in its disposable bucket.

### Layered Readiness

1. Compose executes `/garage status` with a five-second timeout and bounded
   retries. This proves the daemon/RPC path responds, not bucket access. In a
   multi-node system, a successful status command alone is not quorum proof.
2. An idempotent bootstrap establishes the single-node layout, private buckets,
   and permissions. Unexpected existing layouts fail closed. It must not wait
   on bucket readiness before creating the buckets.
3. An external probe observes Admin API `GET /health`; upstream documents
   `200` for available quorum and `503` otherwise. The spike records its
   pre-bootstrap response and requires `200` after bootstrap. It also checks
   structured cluster health.
4. An authenticated S3 `HeadBucket` proves the actual service credential can
   access its bucket. Object read/write/checksum checks are acceptance probes,
   not repeated liveness writes.

The HTTP endpoint is standard health monitoring, but the scratch image has no
HTTP probe utility. A native CLI Compose check plus an external S3 readiness
probe avoids building a custom image solely to add curl. Admin/RPC endpoints
must not become application dependencies. See the
[Admin API health and JSON CLI contract](https://garagehq.deuxfleurs.fr/documentation/reference-manual/admin-api/).

### Replacement And Recovery

The canonical [data and recovery contract](../data-and-recovery.md) defines
authority and consistency boundaries. Buckets, keys, grants, and layout are
recreated; objects move through S3, not Garage internal directories. Retain
bucket/key identity or use an explicit, validated metadata remapping. A future
provider must pass the same application contract, including permission and
checksum checks, before cutover.

The three target buckets are platform source, extraction artifacts, and
correction artifacts. M04-E owns their normal-stack provisioning and separate
service credentials. The spike's one authorized and one denied bucket do not
stand in for those service permissions.

## Acceptance And Consequences

Run the [M04-B spike procedure](../../infra/local/spikes/garage/README.md).
Source and manifest research is complete; runtime checks and human license
review are **not yet accepted**. No image was pulled or run by the agent.
Record results in the working M04 plan before promoting this ADR to Accepted.

Acceptance requires native execution on the available development architecture,
explicit evidence for the other supported architecture (native preferred;
label emulated runs honestly), restart persistence, empty-target reset, S3
operations, metadata/checksums, and both presigning methods. A failed supported
architecture or a need for Garage-only application APIs reopens the provider
decision and blocks M04-E.

M04-B does not add backup commands. M04-H is optional local backup/restore;
M10 owns recovery runbooks and failure testing; M11 owns real stage backups,
retention, RPO/RTO, and a demonstrated stage restore. Single-node local storage
is not high availability and no named volume is a backup.
