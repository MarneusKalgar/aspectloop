import 'reflect-metadata';
import assert from 'node:assert/strict';

import { validateEnv } from '../../config/env.validation';
import appDataSource from '../../data-source';
import { DocumentObject } from '../../documents/document-object.entity';
import { Document } from '../../documents/document.entity';
import { ArtifactStorageError } from '../../storage/artifact-storage.errors';
import { createPlatformArtifactStorage } from '../../storage/create-platform-artifact-storage';
import {
  PLATFORM_ARTIFACT_SEED,
  platformArtifactSeedBody,
  platformArtifactSeedKey,
  platformArtifactSeedSha256,
} from '../seed/platform-artifact.fixture';

/** Reports only the error class because provider and database errors may contain request details. */
function handleFailure(error: unknown): void {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Platform artifact verification failed (${errorName}); details omitted.`);
  process.exitCode = 1;
}

/** Verifies seeded database identity, object bytes, size, checksum, and write-once behavior. */
async function main(): Promise<void> {
  const environment = validateEnv(process.env);
  const storage = createPlatformArtifactStorage(environment);

  try {
    await appDataSource.initialize();
    const document = await appDataSource.getRepository(Document).findOneByOrFail({
      id: PLATFORM_ARTIFACT_SEED.documentId,
    });
    const object = await appDataSource.getRepository(DocumentObject).findOneByOrFail({
      id: PLATFORM_ARTIFACT_SEED.objectId,
    });
    const expectedBody = platformArtifactSeedBody();
    const expectedSha256 = platformArtifactSeedSha256();

    assert.equal(document.ownerId, PLATFORM_ARTIFACT_SEED.ownerId);
    assert.equal(document.documentType, PLATFORM_ARTIFACT_SEED.documentType);
    assert.equal(document.status, 'source_stored');
    assert.equal(object.documentId, document.id);
    assert.equal(object.kind, 'source');
    assert.equal(object.objectKey, platformArtifactSeedKey());
    assert.equal(object.storageBucket, environment.PLATFORM_S3_BUCKET);
    assert.equal(Number(object.byteLength), expectedBody.byteLength);
    assert.equal(object.sha256, expectedSha256);

    await storage.verifyObject({
      bucket: object.storageBucket,
      byteLength: Number(object.byteLength),
      key: object.objectKey,
      objectId: object.id,
      sha256: object.sha256,
    });

    let overwriteRejected = false;

    try {
      await storage.writeObject({
        body: expectedBody,
        contentType: object.contentType,
        key: object.objectKey,
        objectId: object.id,
      });
    } catch (error) {
      if (error instanceof ArtifactStorageError && error.code === 'already_exists') {
        overwriteRejected = true;
      } else {
        throw error;
      }
    }

    assert.equal(overwriteRejected, true, 'Storage adapter accepted an overwrite');
    console.log(
      'Platform artifact verification passed: metadata, bytes, size, SHA-256, write-once.',
    );
  } finally {
    storage.onModuleDestroy();

    if (appDataSource.isInitialized) {
      await appDataSource.destroy();
    }
  }
}

void main().catch(handleFailure);
