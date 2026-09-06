import 'reflect-metadata';

import type { EntityManager } from 'typeorm';

import assert from 'node:assert/strict';

import type { S3ArtifactStorage } from '#app/storage/s3-artifact-storage';

import { validateEnv } from '#app/config/env.validation';
import appDataSource from '#app/data-source';
import { DocumentObject } from '#app/documents/document-object.entity';
import { Document } from '#app/documents/document.entity';
import { ArtifactStorageError } from '#app/storage/artifact-storage.errors';
import { createPlatformArtifactStorage } from '#app/storage/create-platform-artifact-storage';
import { User } from '#app/users/user.entity';

import {
  PLATFORM_ARTIFACT_SEED,
  platformArtifactSeedBody,
  platformArtifactSeedKey,
  platformArtifactSeedSha256,
} from './platform-artifact.fixture';

/** Persists all deterministic metadata inside one platform database transaction. */
async function ensureDatabaseMetadata(
  bucket: string,
  byteLength: number,
  sha256: string,
  manager: EntityManager,
): Promise<void> {
  await ensureOwner(manager);
  await ensureDocument(manager);
  await ensureDocumentObject(manager, bucket, byteLength, sha256);
}

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

/** Inserts one source-object reference or validates every persisted immutable field. */
async function ensureDocumentObject(
  manager: EntityManager,
  bucket: string,
  byteLength: number,
  sha256: string,
): Promise<void> {
  const repository = manager.getRepository(DocumentObject);
  const existing = await repository.findOneBy({ id: PLATFORM_ARTIFACT_SEED.objectId });
  const expected = {
    byteLength: String(byteLength),
    contentType: PLATFORM_ARTIFACT_SEED.contentType,
    documentId: PLATFORM_ARTIFACT_SEED.documentId,
    kind: 'source' as const,
    objectKey: platformArtifactSeedKey(),
    originalFilename: PLATFORM_ARTIFACT_SEED.originalFilename,
    sha256,
    storageBucket: bucket,
  };

  if (existing) {
    assert.deepEqual(
      {
        byteLength: existing.byteLength,
        contentType: existing.contentType,
        documentId: existing.documentId,
        kind: existing.kind,
        objectKey: existing.objectKey,
        originalFilename: existing.originalFilename,
        sha256: existing.sha256,
        storageBucket: existing.storageBucket,
      },
      expected,
      'Seed document object mismatch',
    );

    return;
  }

  await repository.insert({
    ...expected,
    id: PLATFORM_ARTIFACT_SEED.objectId,
  });
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
    id: PLATFORM_ARTIFACT_SEED.ownerId,
    passwordHash: 'not-a-login-credential',
    roles: [],
    scopes: [],
  });
}

/** Writes the deterministic source once, or verifies an already seeded object. */
async function ensureStorageObject(
  storage: S3ArtifactStorage,
  bucket: string,
  objectMetadataExists: boolean,
): Promise<void> {
  const body = platformArtifactSeedBody();
  const expected = {
    bucket,
    byteLength: body.byteLength,
    key: platformArtifactSeedKey(),
    objectId: PLATFORM_ARTIFACT_SEED.objectId,
    sha256: platformArtifactSeedSha256(),
  };

  if (objectMetadataExists) {
    await storage.verifyObject(expected);

    return;
  }

  try {
    await storage.writeObject({
      body,
      contentType: PLATFORM_ARTIFACT_SEED.contentType,
      key: expected.key,
      objectId: expected.objectId,
    });
  } catch (error) {
    if (!(error instanceof ArtifactStorageError) || error.code !== 'already_exists') {
      throw error;
    }

    await storage.verifyObject(expected);
  }
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
    const objectMetadataExists = Boolean(
      await appDataSource
        .getRepository(DocumentObject)
        .findOneBy({ id: PLATFORM_ARTIFACT_SEED.objectId }),
    );

    await ensureStorageObject(storage, environment.PLATFORM_S3_BUCKET, objectMetadataExists);
    await appDataSource.transaction(
      ensureDatabaseMetadata.bind(
        undefined,
        environment.PLATFORM_S3_BUCKET,
        platformArtifactSeedBody().byteLength,
        platformArtifactSeedSha256(),
      ),
    );
    console.log('Platform artifact seed ready.');
  } finally {
    storage.onModuleDestroy();

    if (appDataSource.isInitialized) {
      await appDataSource.destroy();
    }
  }
}

void main().catch(handleFailure);
