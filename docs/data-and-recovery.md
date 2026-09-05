# Data Authority And Recovery

Status: Accepted M04-B contract and M04-C/M04-D database foundations (2026-09-05)

This is the M04 authoritative-state contract, not a claim that backup/restore
is implemented. M04-B completed the boundary and disposable S3 compatibility
proof; M04-C established the PostgreSQL 18 database ownership baseline; and
M04-D established each backend service's datasource, migration, seed, and local
runtime boundary. Later submilestones implement the remaining object-storage,
domain-data, integrated-stack, and recovery tooling.
See [the local S3 decision](decisions/0003-local-s3-and-recovery-boundary.md)
for provider and readiness constraints.

## Current State

After M04-D and before M04-E/M04-F, the normal local stack has one
PostgreSQL 18 container with `platform_db`, `extraction_db`, and
`correction_db`, separate least-privilege owner roles, RabbitMQ, and a
file-backed HTTP persistence mock. Gateway, extraction, and correction each
connect only to their owned database with a bounded pool. All three have
explicit service-owned migration and seed commands; extraction and correction
still have no domain entities, migrations, or seed data. There is no
source-object catalog, normal-stack Garage integration, or executable
cross-store backup/restore workflow.

| Current state                                       | Authority and recovery consequence                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway `platform_db` on PostgreSQL 18              | Users, correction sessions, immutable source snapshots, draft snapshots, edit audit, outbox, and migration history. Preserve together.                                      |
| Extraction/correction databases on PostgreSQL 18    | Each has an owner-only datasource plus explicit migration/seed boundaries. No domain schema or rows exist yet; an empty migration history is expected.                      |
| Persistence mock JSON files                         | Mutable documents, including documents without an opened session and updates not necessarily committed in PostgreSQL. Non-seed contents are not guaranteed reconstructible. |
| Mock seeds and document registry                    | Repository-owned fixtures/configuration; restarting the mock adds missing seeds but does not reconstruct user edits.                                                        |
| RabbitMQ                                            | Delivery transport. The Compose file declares no repository-owned broker data volume; queue contents are not the recovery authority.                                        |
| Browser state, generated output, dependencies, logs | Not an authoritative export of committed application state. Unsaved browser edits are outside recovery guarantees.                                                          |

The current Compose volume keys are `aspectloop_api_postgres18_data` and
`aspectloop_api_persistence_mock_data`, prefixed by the selected project name.
The retained PostgreSQL 16 volume is deliberately outside the current Compose
graph and is never attached to PostgreSQL 18. The mock mounts its volume at
`/data`, with documents normally under
`/data/documents`; a custom `PERSISTENCE_MOCK_DATA_DIR` must be checked against
the actual mount before claiming durability. Host-run mock data defaults to
`mocks/persistence-service/data/documents`.

### Persistence Mock Callers

[`PersistenceClient`](../apps/gateway-api/src/persistence/persistence.client.ts)
is the gateway HTTP adapter for `GET/PUT /documents/:documentId`.

| Caller                                  | Operation                               | State boundary                                                                                                  |
| --------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `CorrectionSessionsService.openSession` | GET document when opening a new session | Normalizes payload and captures source/draft snapshots in PostgreSQL. Existing sessions reuse stored snapshots. |
| `CorrectionSessionsService.saveDraft`   | PUT normalized draft                    | Writes the mock before updating the PostgreSQL session.                                                         |
| `CorrectionsService.submitCorrections`  | PUT merged document                     | Writes the mock before the PostgreSQL transaction that advances session, audit, and outbox state.               |

Sources: [session service](../apps/gateway-api/src/correction-sessions/correction-sessions.service.ts),
[submission service](../apps/gateway-api/src/corrections/corrections.service.ts),
[mock server](../mocks/persistence-service/src/server.mjs), and
[document storage](../mocks/persistence-service/src/storage/document-store.mjs).
These are separate commits across stores, not one distributed transaction.
A PostgreSQL failure or conflict can leave the mock ahead of the session.
Quiescing future writes does not repair an already divergent pair.

Until all three callers have equivalent, human-verified replacements, preserve
the mock alongside PostgreSQL when retaining local data. A backup excluding it
is **not a complete backup of the current correction app**. The future M04-H
format must either cover this transitional JSON state with validation, or
explicitly refuse to claim full-app recovery while it remains authoritative.
Do not delete the mock volume merely because Garage is available. M06 owns the
correction-service transition; M04 does not silently migrate these callers.

## M04 Target Authority

| State                                                           | Owner                                     | Backup and recovery treatment                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `platform_db`                                                   | Gateway/platform                          | Users, platform documents, object metadata, migration history; temporary gateway correction tables remain here until M06. |
| `extraction_db`                                                 | Extraction service                        | Include schema, migration history, and owned rows, even if domain tables are not present before M05.                      |
| `correction_db`                                                 | Correction service                        | Include schema, migration history, and owned rows; do not duplicate the temporary gateway tables.                         |
| Referenced source/artifact bytes                                | Owning private S3 bucket                  | Export bytes and metadata through S3; validate every DB reference using bucket/key, size, and application SHA-256.        |
| Buckets, layout, keys, grants                                   | Repository bootstrap and secret injection | Recreate with reviewed configuration; do not archive Garage internal metadata as the portable recovery format.            |
| Outbox rows                                                     | Owning PostgreSQL database                | Include with relational state. Preserve delivery status; do not mark published events pending automatically.              |
| RabbitMQ messages                                               | Transport                                 | Exclude from the local backup set; draining or reconstruction requires explicit application semantics.                    |
| Logs, traces, metrics                                           | Diagnostic                                | Exclude from the data backup set; operational diagnostic retention is separate.                                           |
| Build output, caches, generated files, `node_modules`           | Reconstructible                           | Recreate from reviewed source, lockfile, and generation commands.                                                         |
| `.env.local`, passwords, API keys, signing keys, presigned URLs | Secret injection                          | Exclude from the export payload and evidence; recreate or rotate separately.                                              |
| Compose named volumes                                           | Working storage                           | Persist restarts, but are not backups and do not survive volume deletion.                                                 |

Objects use generated opaque keys; original filenames are validated display
metadata, never keys. Treat the bucket/key pair as identity. Database metadata
stores byte length and lower-case SHA-256. Object custom metadata can carry
the digest, but restoration must hash the bytes rather than trust metadata or
ETag. Application writes are write-once; administrative import/reset is a
separate boundary. No cross-database foreign keys or cross-owner writes.

## Consistency Boundary

A complete local backup is **one logical database-and-object recovery set**,
not unrelated SQL and bucket exports from different times. It contains all
three databases and all configured artifact buckets, plus an explicit treatment
of the temporary mock if still required.

Stop ingress, gateway mutations, artifact-producing workers, seeds, migrations,
and periodic outbox relays before export. Drain in-flight operations or abort
the backup; keep writers stopped throughout every export and manifest creation.
The current relay runs inside the gateway, so merely closing the browser is
not quiescence. Confirm there are no direct DB/S3 writers outside the app.

Use logical PostgreSQL custom-format dumps and portable S3 object export.
Complete the manifest last. It must identify a format version, UTC timestamp,
source revision, server/tool versions, intended restore major, database/owner
names, migration versions, bucket mapping, file inventory, counts, sizes, and
checksums for export files and objects. No manifest means no completed backup.
Missing data, inconsistent references, unfinished uploads, or unsupported
format/source/target versions must fail closed, not produce a success marker.

The host backup directory is outside Compose volumes and not tracked source.
Excluding credential files does not make the backup non-sensitive: database
dumps may contain password hashes and documents may contain personal data.
Access control and secure handling remain necessary. Do not attach dumps,
object bytes, or credentials to verification evidence.

This contract does not promise online cross-store snapshots, PITR, queue replay,
automatic reconciliation, or a zero-loss recovery point. M04-H may be explicitly
deferred, leaving this as a documented boundary rather than an available tool.

## Restore Ordering

1. Validate the complete manifest and export-file checksums before modifying a
   target. Use a new, empty, isolated target; refuse non-empty databases/buckets.
   Keep the original volumes and backup unchanged.
2. Recreate service database owners/runtime roles and private bucket permissions
   from reviewed configuration. Inject replacement credentials outside the
   backup. Do not restore broad admin credentials into application roles.
3. Restore each database's schema, data, and TypeORM migration history together.
   Verify that history before applying only migrations newer than the backup.
   Never run all migrations first and then import a duplicate schema/history.
4. Import objects via S3 with their bucket/key identity, content type, metadata,
   and bytes. Restore or reconcile the temporary mock under its explicit
   compatibility procedure if it is part of this recovery set. Keep apps off.
5. Validate constraints, ownership/grants, migration history, representative row
   counts, and every DB object reference. Recompute object size and SHA-256;
   report missing/corrupt/unexpected objects. Orphan cleanup is not automatic.
6. Reconcile pending/failed/published outbox state and downstream delivery before
   resuming workers or opening traffic. Broker emptiness does not prove that
   replay is safe; the current best-effort relay is not an exactly-once promise.
7. Resume traffic only after the human accepts integrity and application checks.
   Retain failed targets for bounded diagnosis; rerun into a clean target rather
   than continuing a partial restore without an explicit recovery procedure.

The PostgreSQL 16 to 18 drill is a logical dump/restore into a new PG18 volume,
using compatible reviewed client tools. Never mount a PG16 data directory into
PG18. Preserve the PG16 volume until the human accepts the new state or
explicitly discards it. A version upgrade is not evidence that all three
databases or artifacts were backed up.

## Milestone Ownership

- **M04-B P0, completed:** accepted authority and provider/recovery boundaries,
  with disposable S3 proof on native arm64 and amd64. This did not replace the
  persistence mock or add Garage to the normal application stack.
- **M04-C P0, completed:** accepted PostgreSQL 18, three isolated logical
  databases and owner roles, the PG18-specific volume boundary, checksums, and
  the aggregate local connection budget. This did not add extraction or
  correction service datasources.
- **M04-E/F/G P0:** normal Garage integration, artifact model/adapter, and
  integrated verification. No automatic recovery claim follows from startup.
- **M04-H P1:** optional local backup/restore and PG16-to-PG18 rehearsal with a
  versioned manifest, clean targets, and human-confirmed restore evidence.
- **M08:** reliable delivery, idempotency, and explicit outbox replay semantics.
- **M10:** recovery runbook, deterministic failure exercises, and diagnostic
  evidence. Local failure drills are not stage backup acceptance.
- **M11:** real stage backups, retention, access/encryption policy, defined
  RPO/RTO, and a demonstrated stage restore. Local Garage results do not select
  a stage object provider or prove its operational recovery behavior.
