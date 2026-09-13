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
