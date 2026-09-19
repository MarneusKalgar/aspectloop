import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import type { EnvironmentVariables } from '#app/config/env.schema';
import type { CreateSourceObjectInput } from '#app/documents/source-object/source-object-reservation.types';

import { validateEnv } from '#app/config/env.validation';
import { getTypeOrmDataSourceOptions } from '#app/config/typeorm';
import { DocumentObjectReservation } from '#app/documents/model/document-object-reservation.entity';
import { DocumentObject } from '#app/documents/model/document-object.entity';
import { Document } from '#app/documents/model/document.entity';
import { SourceObjectReservationError } from '#app/documents/source-object/reservation/source-object-reservation.errors';
import { TypeOrmSourceObjectReservationStore } from '#app/documents/source-object/reservation/typeorm-source-object-reservation.store';
import { SourceObjectCoordinator } from '#app/documents/source-object/source-object-coordinator';
import { prepareSourceObject } from '#app/documents/source-object/source-object.utils';
import { ArtifactStorageError } from '#app/storage/artifact-storage.errors';
import { createPlatformArtifactStorage } from '#app/storage/create-platform-artifact-storage';

import { PLATFORM_ARTIFACT_SEED } from '../seed/platform-artifact.fixture';

interface VerificationClient {
  coordinator: SourceObjectCoordinator;
  dataSource: DataSource;
  reservations: TypeOrmSourceObjectReservationStore;
  storage: ReturnType<typeof createPlatformArtifactStorage>;
}

/** Compares binary content independently of Buffer versus Uint8Array representation. */
function assertBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
  assert.deepEqual(Buffer.from(actual), Buffer.from(expected), 'Stored object bytes changed');
}

/** Confirms an object identity was never written by the losing reservation caller. */
async function assertObjectAbsent(
  client: VerificationClient,
  command: CreateSourceObjectInput,
): Promise<void> {
  const prepared = prepareSourceObject(command);

  try {
    await client.storage.headObject({
      bucket: prepared.storageBucket,
      key: prepared.objectKey,
      objectId: prepared.objectId,
    });
    assert.fail('Losing reservation caller wrote an object');
  } catch (error) {
    assert.equal(error instanceof ArtifactStorageError && error.code === 'not_found', true);
  }
}

/** Creates one independent database pool, storage client, store, and coordinator. */
function createVerificationClient(environment: EnvironmentVariables): VerificationClient {
  const dataSource = new DataSource(
    getTypeOrmDataSourceOptions({
      databaseUrl: environment.DATABASE_URL,
      discoveryMode: 'source',
      nodeEnv: environment.NODE_ENV,
      poolSize: 2,
      slowQueryThresholdMs: environment.DB_SLOW_QUERY_THRESHOLD_MS,
    }),
  );
  const reservations = new TypeOrmSourceObjectReservationStore(dataSource);
  const storage = createPlatformArtifactStorage(environment);

  return {
    coordinator: new SourceObjectCoordinator(reservations, storage),
    dataSource,
    reservations,
    storage,
  };
}

/** Reports only the error class because provider and database errors may contain request details. */
function handleFailure(error: unknown): void {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(
    `Platform artifact concurrency verification failed (${errorName}); details omitted.`,
  );
  process.exitCode = 1;
}

/** Inserts a fresh document owned by the deterministic local seed identity. */
async function insertDocument(dataSource: DataSource, documentId: string): Promise<void> {
  await dataSource.getRepository(Document).insert({
    documentType: PLATFORM_ARTIFACT_SEED.documentType,
    id: documentId,
    ownerId: PLATFORM_ARTIFACT_SEED.ownerId,
    status: 'source_stored',
  });
}

/** Runs the real PostgreSQL and Garage concurrency/recovery verification. */
async function main(): Promise<void> {
  const environment = validateEnv(process.env);
  const first = createVerificationClient(environment);
  const second = createVerificationClient(environment);

  try {
    await Promise.all([first.dataSource.initialize(), second.dataSource.initialize()]);
    await first.dataSource.getRepository(Document).findOneByOrFail({
      id: PLATFORM_ARTIFACT_SEED.documentId,
    });
    await verifyConcurrentWinner(environment, first, second);
    await verifyPostUploadRecovery(environment, first, second);
    console.log(
      'Platform artifact concurrency verification passed: one winner, no overwrite, expired-lease recovery.',
    );
  } finally {
    first.storage.onModuleDestroy();
    second.storage.onModuleDestroy();
    await Promise.all(
      [first.dataSource, second.dataSource]
        .filter((dataSource) => dataSource.isInitialized)
        .map((dataSource) => dataSource.destroy()),
    );
  }
}

/** Builds one source command with an opaque identity and caller-specific bytes. */
function sourceCommand(
  environment: EnvironmentVariables,
  documentId: string,
  objectId: string,
  body: Uint8Array,
): CreateSourceObjectInput {
  return {
    body,
    contentType: 'text/plain',
    documentId,
    documentType: PLATFORM_ARTIFACT_SEED.documentType,
    kind: 'source',
    objectId,
    originalFilename: 'concurrency-source.txt',
    ownerId: PLATFORM_ARTIFACT_SEED.ownerId,
    storageBucket: environment.PLATFORM_S3_BUCKET,
  };
}

/** Proves two independent clients cannot both upload or finalize one logical source. */
async function verifyConcurrentWinner(
  environment: EnvironmentVariables,
  first: VerificationClient,
  second: VerificationClient,
): Promise<void> {
  const documentId = randomUUID();
  const commands = [
    sourceCommand(environment, documentId, randomUUID(), Buffer.from('first competing source')),
    sourceCommand(environment, documentId, randomUUID(), Buffer.from('second competing source')),
  ] as const;
  await insertDocument(first.dataSource, documentId);

  const results = await Promise.allSettled([
    first.coordinator.createSourceObject(commands[0]),
    second.coordinator.createSourceObject(commands[1]),
  ]);
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Expected exactly one finalized concurrency winner');
  assert.equal(rejected.length, 1, 'Expected exactly one rejected concurrency loser');
  assert.equal(
    rejected[0]?.reason instanceof SourceObjectReservationError &&
      rejected[0].reason.code === 'identity_conflict',
    true,
    'Concurrency loser did not receive the bounded identity conflict',
  );

  const reservation = await first.dataSource
    .getRepository(DocumentObjectReservation)
    .findOneByOrFail({ documentId, kind: 'source' });
  const objects = await first.dataSource.getRepository(DocumentObject).findBy({
    documentId,
    kind: 'source',
  });
  assert.equal(reservation.status, 'finalized');
  assert.equal(objects.length, 1);

  const winnerIndex = commands.findIndex((command) => command.objectId === reservation.objectId);
  assert.notEqual(winnerIndex, -1);
  const winner = commands[winnerIndex];
  const loser = commands[winnerIndex === 0 ? 1 : 0];
  assert.ok(winner);
  assert.ok(loser);
  const stored = await first.storage.getObject({
    bucket: reservation.storageBucket,
    key: reservation.objectKey,
    objectId: reservation.objectId,
  });
  assertBytesEqual(stored.body, winner.body);
  assert.equal(stored.sha256, reservation.sha256);
  await assertObjectAbsent(first, loser);

  await assert.rejects(
    second.coordinator.createSourceObject(loser),
    (error: unknown) =>
      error instanceof SourceObjectReservationError && error.code === 'identity_conflict',
  );
  const unchanged = await first.storage.getObject({
    bucket: reservation.storageBucket,
    key: reservation.objectKey,
    objectId: reservation.objectId,
  });
  assertBytesEqual(unchanged.body, winner.body);
}

/** Proves an expired post-upload lease verifies existing bytes and finalizes them. */
async function verifyPostUploadRecovery(
  environment: EnvironmentVariables,
  first: VerificationClient,
  second: VerificationClient,
): Promise<void> {
  const documentId = randomUUID();
  const command = sourceCommand(
    environment,
    documentId,
    randomUUID(),
    Buffer.from('post-upload recovery source'),
  );
  const prepared = prepareSourceObject(command);
  await insertDocument(first.dataSource, documentId);
  const acquired = await first.reservations.acquire(prepared);
  assert.equal(acquired.outcome, 'acquired');

  if (acquired.outcome !== 'acquired') {
    throw new SourceObjectReservationError('lease_lost');
  }

  await first.storage.writeObject({
    body: command.body,
    contentType: command.contentType,
    key: prepared.objectKey,
    objectId: prepared.objectId,
  });
  const reservation = await first.dataSource
    .getRepository(DocumentObjectReservation)
    .findOneByOrFail({ id: acquired.lease.reservationId });
  await first.dataSource
    .getRepository(DocumentObjectReservation)
    .update(
      { id: reservation.id },
      { leaseExpiresAt: new Date(reservation.createdAt.getTime() + 1) },
    );

  const recovered = await second.coordinator.createSourceObject(command);
  assert.equal(recovered.outcome, 'finalized');
  assert.equal(recovered.acquiredLease, true);

  if (recovered.outcome !== 'finalized' || !recovered.acquiredLease) {
    throw new SourceObjectReservationError('lease_lost');
  }

  assert.equal(recovered.recoveredUpload, true);
  assert.equal(recovered.object.sha256, prepared.sha256);
  assert.equal(
    await first.dataSource.getRepository(DocumentObject).countBy({ documentId, kind: 'source' }),
    1,
  );
}

void main().catch(handleFailure);
