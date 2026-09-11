/** S3-compatible bucket names accepted by the gateway configuration boundary. */
export const S3_BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/** Lower-case application SHA-256 digest persisted with each object. */
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/** Canonical UUID text accepted for bounded document-object log identifiers. */
export const UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/** Opaque source keys contain only stable document and object UUIDs. */
export const SOURCE_OBJECT_KEY_PATTERN = /^documents\/[a-f0-9-]{36}\/source\/[a-f0-9-]{36}$/i;

/** Correlation identifiers are bounded opaque diagnostics, never arbitrary request data. */
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const MAX_ARTIFACT_OPERATION_TIMEOUT_MS = 30_000;
export const MAX_CONTENT_TYPE_LENGTH = 255;
