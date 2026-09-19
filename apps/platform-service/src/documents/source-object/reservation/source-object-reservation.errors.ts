export type SourceObjectReservationErrorCode =
  | 'document_mismatch'
  | 'identity_conflict'
  | 'invalid_input'
  | 'lease_lost'
  | 'recovery_required'
  | 'retry_exhausted'
  | 'storage_failure';

export class SourceObjectReservationError extends Error {
  constructor(readonly code: SourceObjectReservationErrorCode) {
    super(`Source object reservation failed (${code})`);
    this.name = SourceObjectReservationError.name;
  }
}
