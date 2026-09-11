export const DOCUMENT_STATUSES = [
  'source_stored',
  'extraction_queued',
  'extraction_processing',
  'extraction_completed',
  'extraction_failed',
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_OBJECT_KINDS = ['source'] as const;

export type DocumentObjectKind = (typeof DOCUMENT_OBJECT_KINDS)[number];

export const PLATFORM_SOURCE_BUCKET_ROLE = 'platform-source';

/**
 * Builds the opaque write-once key for one platform-owned source object.
 *
 * @param documentId Owning platform document UUID.
 * @param objectId Platform document-object UUID.
 * @returns Deterministic source-object key independent of the original filename.
 */
export function buildSourceObjectKey(documentId: string, objectId: string): string {
  return `documents/${documentId}/source/${objectId}`;
}
