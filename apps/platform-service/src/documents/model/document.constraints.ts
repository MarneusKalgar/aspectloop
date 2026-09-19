/** Restricts platform workflow state to the M04/M05 lifecycle vocabulary. */
export const DOCUMENT_STATUS_CHECK =
  `"status" IN ('source_stored', 'extraction_queued', 'extraction_processing', ` +
  `'extraction_completed', 'extraction_failed')`;

/** Optimistic versions are positive and advance from the initial value of one. */
export const DOCUMENT_VERSION_CHECK = '"version" >= 1';

/** Document types must identify one non-empty registry entry. */
export const DOCUMENT_TYPE_CHECK = 'char_length(trim("document_type")) > 0';

/** M04 stores exactly one bounded source-object kind. */
export const DOCUMENT_OBJECT_KIND_CHECK = `"kind" IN ('source')`;

/** Stored bucket aliases follow the portable S3 naming subset. */
export const DOCUMENT_OBJECT_BUCKET_CHECK = `"storage_bucket" ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'`;

/** Object keys are derived only from their owning document and object UUIDs. */
export const DOCUMENT_OBJECT_KEY_IDENTITY_CHECK = `"object_key" = 'documents/' || "document_id"::text || '/source/' || "id"::text`;

/** Display filenames are non-empty and cannot contain paths or control bytes. */
export const DOCUMENT_OBJECT_FILENAME_CHECK =
  `char_length(trim("original_filename")) > 0 AND ` +
  `strpos("original_filename", '/') = 0 AND ` +
  `strpos("original_filename", chr(92)) = 0 AND ` +
  `"original_filename" !~ '[[:cntrl:]]'`;

/** Content types must contain a bounded non-whitespace value. */
export const DOCUMENT_OBJECT_CONTENT_TYPE_CHECK = 'char_length(trim("content_type")) > 0';

/** Byte lengths are positive and remain exactly representable by JavaScript. */
export const DOCUMENT_OBJECT_BYTE_LENGTH_CHECK =
  '"byte_length" > 0 AND "byte_length" <= 9007199254740991';

/** Checksums are canonical lower-case SHA-256 hexadecimal values. */
export const DOCUMENT_OBJECT_SHA256_CHECK = `"sha256" ~ '^[0-9a-f]{64}$'`;

/** Reservation attempts are positive and bounded to prevent unbounded retry loops. */
export const DOCUMENT_OBJECT_RESERVATION_ATTEMPT_CHECK =
  '"attempt_count" >= 1 AND "attempt_count" <= 10';

/** Reservation failure codes remain within the storage adapter's durable vocabulary. */
export const DOCUMENT_OBJECT_RESERVATION_FAILURE_CODE_CHECK =
  `"failure_code" IS NULL OR "failure_code" IN (` +
  `'integrity_mismatch', 'invalid_location', 'invalid_response', 'not_found', 'unavailable')`;

/** Finalization cannot predate reservation creation. */
export const DOCUMENT_OBJECT_RESERVATION_FINALIZED_AT_CHECK =
  '"finalized_at" IS NULL OR "finalized_at" >= "created_at"';

/** Reservation keys are derived only from their document and object UUIDs. */
export const DOCUMENT_OBJECT_RESERVATION_KEY_IDENTITY_CHECK = `"object_key" = 'documents/' || "document_id"::text || '/source/' || "object_id"::text`;

/** M04 reservations represent exactly one bounded source-object kind. */
export const DOCUMENT_OBJECT_RESERVATION_KIND_CHECK = `"kind" IN ('source')`;

/** Every reservation lease has a positive initial duration. */
export const DOCUMENT_OBJECT_RESERVATION_LEASE_CHECK = '"lease_expires_at" > "created_at"';

/** Status, failure, and finalization fields form one valid reservation state. */
export const DOCUMENT_OBJECT_RESERVATION_STATE_CHECK =
  `("status" = 'pending' AND "failure_code" IS NULL AND "finalized_at" IS NULL) OR ` +
  `("status" = 'failed' AND "failure_code" IS NOT NULL AND "finalized_at" IS NULL) OR ` +
  `("status" = 'finalized' AND "failure_code" IS NULL AND "finalized_at" IS NOT NULL)`;

/** Reservation status remains within the finite state-machine vocabulary. */
export const DOCUMENT_OBJECT_RESERVATION_STATUS_CHECK = `"status" IN ('pending', 'failed', 'finalized')`;
