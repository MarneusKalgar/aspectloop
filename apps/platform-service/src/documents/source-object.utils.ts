import { createHash } from 'node:crypto';

import type { ArtifactStorageErrorCode } from '../storage/artifact-storage.errors';
import type {
  CreateSourceObjectInput,
  PreparedSourceObject,
} from './source-object-reservation.types';

import {
  MAX_CONTENT_TYPE_LENGTH,
  S3_BUCKET_NAME_PATTERN,
  UUID_PATTERN,
} from '../storage/artifact-storage.constants';
import { ArtifactStorageError } from '../storage/artifact-storage.errors';
import { buildSourceObjectKey } from './document.constants';
import { SourceObjectReservationError } from './source-object-reservation.errors';

const MAX_DOCUMENT_TYPE_LENGTH = 64;
const MAX_ORIGINAL_FILENAME_LENGTH = 255;

/**
 * Canonicalizes and validates one source request before it can acquire database state.
 *
 * @param input Source bytes and caller-authorized document identity.
 * @returns Stable location and integrity metadata used by every later state transition.
 */
export function prepareSourceObject(input: CreateSourceObjectInput): PreparedSourceObject {
  if (
    !(input.body instanceof Uint8Array) ||
    !Number.isSafeInteger(input.body.byteLength) ||
    input.body.byteLength <= 0 ||
    !UUID_PATTERN.test(input.documentId) ||
    !UUID_PATTERN.test(input.objectId) ||
    !UUID_PATTERN.test(input.ownerId) ||
    input.kind !== 'source' ||
    !S3_BUCKET_NAME_PATTERN.test(input.storageBucket) ||
    input.contentType.trim().length === 0 ||
    input.contentType.length > MAX_CONTENT_TYPE_LENGTH ||
    input.documentType.trim().length === 0 ||
    input.documentType.length > MAX_DOCUMENT_TYPE_LENGTH ||
    input.originalFilename.trim().length === 0 ||
    input.originalFilename.length > MAX_ORIGINAL_FILENAME_LENGTH ||
    hasUnsafeFilenameCharacter(input.originalFilename)
  ) {
    throw new SourceObjectReservationError('invalid_input');
  }

  return {
    byteLength: input.body.byteLength,
    contentType: input.contentType,
    documentId: input.documentId,
    documentType: input.documentType,
    kind: input.kind,
    objectId: input.objectId,
    objectKey: buildSourceObjectKey(input.documentId, input.objectId),
    originalFilename: input.originalFilename,
    ownerId: input.ownerId,
    sha256: createHash('sha256').update(input.body).digest('hex'),
    storageBucket: input.storageBucket,
  };
}

/** Maps arbitrary adapter failures to the finite database failure-code vocabulary. */
export function toReservationFailureCode(
  error: unknown,
): Exclude<ArtifactStorageErrorCode, 'already_exists'> {
  if (error instanceof ArtifactStorageError && error.code !== 'already_exists') {
    return error.code;
  }

  return 'unavailable';
}

/** Detects path separators and control characters without a control-character regular expression. */
function hasUnsafeFilenameCharacter(filename: string): boolean {
  return Array.from(filename).some((character) => {
    const characterCode = character.charCodeAt(0);

    return (
      character === '/' || character === '\\' || characterCode <= 0x1f || characterCode === 0x7f
    );
  });
}
