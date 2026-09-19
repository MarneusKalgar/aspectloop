export type ArtifactStorageErrorCode =
  | 'already_exists'
  | 'integrity_mismatch'
  | 'invalid_location'
  | 'invalid_response'
  | 'not_found'
  | 'unavailable';

export type ArtifactStorageOperation = 'get' | 'head' | 'verify' | 'write';

export class ArtifactStorageError extends Error {
  constructor(
    readonly code: ArtifactStorageErrorCode,
    readonly operation: ArtifactStorageOperation,
  ) {
    super(`Artifact storage ${operation} failed (${code})`);
    this.name = ArtifactStorageError.name;
  }
}
