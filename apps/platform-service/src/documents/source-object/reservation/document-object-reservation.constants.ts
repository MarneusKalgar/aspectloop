export const DOCUMENT_OBJECT_RESERVATION_STATUSES = ['pending', 'failed', 'finalized'] as const;

export type DocumentObjectReservationStatus = (typeof DOCUMENT_OBJECT_RESERVATION_STATUSES)[number];

export const DOCUMENT_OBJECT_RESERVATION_FAILURE_CODES = [
  'integrity_mismatch',
  'invalid_location',
  'invalid_response',
  'not_found',
  'unavailable',
] as const;

export type DocumentObjectReservationFailureCode =
  (typeof DOCUMENT_OBJECT_RESERVATION_FAILURE_CODES)[number];

export const DOCUMENT_OBJECT_RESERVATION_LEASE_MS = 60_000;
export const DOCUMENT_OBJECT_RESERVATION_MAX_ATTEMPTS = 10;
