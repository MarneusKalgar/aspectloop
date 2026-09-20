import 'reflect-metadata';

import type { EntityManager } from 'typeorm';

import assert from 'node:assert/strict';

import { validateEnv } from '#app/config/env.validation';
import appDataSource from '#app/data-source';
import { Document } from '#app/documents/model/document.entity';
import { TypeOrmSourceObjectReservationStore } from '#app/documents/source-object/reservation/typeorm-source-object-reservation.store';
import { SourceObjectCoordinator } from '#app/documents/source-object/source-object-coordinator';
import { createPlatformArtifactStorage } from '#app/storage/create-platform-artifact-storage';
import { User } from '#app/users/user.entity';

import { PLATFORM_ARTIFACT_SEED, platformArtifactSeedBody } from './platform-artifact.fixture';

/** Inserts the deterministic platform document or validates its immutable identity. */
async function ensureDocument(manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(Document);
  const existing = await repository.findOneBy({ id: PLATFORM_ARTIFACT_SEED.documentId });

  if (existing) {
    assert.equal(existing.ownerId, PLATFORM_ARTIFACT_SEED.ownerId, 'Seed document owner mismatch');
    assert.equal(
      existing.documentType,
      PLATFORM_ARTIFACT_SEED.documentType,
      'Seed document type mismatch',
    );

    return;
  }

  await repository.insert({
    documentType: PLATFORM_ARTIFACT_SEED.documentType,
    id: PLATFORM_ARTIFACT_SEED.documentId,
    ownerId: PLATFORM_ARTIFACT_SEED.ownerId,
    status: 'source_stored',
  });
}

/** Persists the deterministic owner and document before source-object coordination. */
async function ensureDocumentIdentity(manager: EntityManager): Promise<void> {
  await ensureOwner(manager);
  await ensureDocument(manager);
}

/** Inserts the deterministic non-login owner or validates the existing row. */
async function ensureOwner(manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(User);
  const existing = await repository.findOneBy({ id: PLATFORM_ARTIFACT_SEED.ownerId });

  if (existing) {
    assert.equal(existing.email, PLATFORM_ARTIFACT_SEED.ownerEmail, 'Seed owner identity mismatch');

    return;
  }

  await repository.insert({
    displayName: 'M04 platform artifact seed',
    email: PLATFORM_ARTIFACT_SEED.ownerEmail,
    emailVerifiedAt: null,
    id: PLATFORM_ARTIFACT_SEED.ownerId,
    passwordHash: 'not-a-login-credential',
    roles: [],
    scopes: [],
  });
}

/** Reports only the error class because provider and database errors may contain request details. */
function handleFailure(error: unknown): void {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Platform artifact seed failed (${errorName}); details omitted.`);
  process.exitCode = 1;
}

/** Seeds one deterministic source object and its matching platform metadata. */
async function main(): Promise<void> {
  const environment = validateEnv(process.env);
  const storage = createPlatformArtifactStorage(environment);

  try {
    await appDataSource.initialize();
    await appDataSource.transaction(ensureDocumentIdentity);
    const coordinator = new SourceObjectCoordinator(
      new TypeOrmSourceObjectReservationStore(appDataSource),
      storage,
    );
    const result = await coordinator.createSourceObject({
      body: platformArtifactSeedBody(),
      contentType: PLATFORM_ARTIFACT_SEED.contentType,
      documentId: PLATFORM_ARTIFACT_SEED.documentId,
      documentType: PLATFORM_ARTIFACT_SEED.documentType,
      kind: 'source',
      objectId: PLATFORM_ARTIFACT_SEED.objectId,
      originalFilename: PLATFORM_ARTIFACT_SEED.originalFilename,
      ownerId: PLATFORM_ARTIFACT_SEED.ownerId,
      storageBucket: environment.PLATFORM_S3_BUCKET,
    });

    assert.equal(result.outcome, 'finalized', 'Platform seed source is still in progress');
    console.log('Platform artifact seed ready.');
  } finally {
    storage.onModuleDestroy();

    if (appDataSource.isInitialized) {
      await appDataSource.destroy();
    }
  }
}

void main().catch(handleFailure);
