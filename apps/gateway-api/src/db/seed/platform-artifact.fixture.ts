import { buildSourceObjectKey } from '@app/documents/document.constants';
import { createHash } from 'node:crypto';

export const PLATFORM_ARTIFACT_SEED = Object.freeze({
  content: 'AspectLoop deterministic platform source fixture.\n',
  contentType: 'text/plain',
  documentId: '1f3d9a20-7304-4c6d-8f21-250f07fc9451',
  documentType: 'supplier_invoice',
  objectId: '2e49b681-0df5-46bc-91ea-c9024689755e',
  originalFilename: 'm04-source.txt',
  ownerEmail: 'm04-artifact-seed@example.invalid',
  ownerId: '5f1a0b4e-7c2d-4e9f-8a31-6b2c9d0e4f10',
});

/** Returns the deterministic non-sensitive source bytes used by local verification. */
export function platformArtifactSeedBody(): Uint8Array {
  return Buffer.from(PLATFORM_ARTIFACT_SEED.content, 'utf8');
}

/** Returns the filename-independent key required by the document-object constraint. */
export function platformArtifactSeedKey(): string {
  return buildSourceObjectKey(PLATFORM_ARTIFACT_SEED.documentId, PLATFORM_ARTIFACT_SEED.objectId);
}

/** Returns the application SHA-256 expected for the deterministic source bytes. */
export function platformArtifactSeedSha256(): string {
  return createHash('sha256').update(platformArtifactSeedBody()).digest('hex');
}
