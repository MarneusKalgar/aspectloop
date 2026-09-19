import type { DocumentObjectReservation } from '../../model/document-object-reservation.entity';
import type {
  FinalizedSourceObject,
  PreparedSourceObject,
} from '../source-object-reservation.types';

import { DOCUMENT_OBJECT_RESERVATION_MAX_ATTEMPTS } from './document-object-reservation.constants';
import { SourceObjectReservationError } from './source-object-reservation.errors';

export type ExistingReservationDecision =
  | { leaseExpiresAt: Date; outcome: 'in_progress'; reservationId: string }
  | { nextAttemptCount: number; outcome: 'retry' }
  | { object: FinalizedSourceObject; outcome: 'finalized' };

/**
 * Decides how one locked reservation responds to a matching source request.
 *
 * @param reservation Existing row protected by a pessimistic write lock.
 * @param input Canonical source identity and integrity metadata.
 * @param now Database-operation decision time.
 * @returns Finalized, in-progress, or retry disposition.
 */
export function decideExistingReservation(
  reservation: DocumentObjectReservation,
  input: PreparedSourceObject,
  now: Date,
): ExistingReservationDecision {
  if (!matchesReservationIdentity(reservation, input)) {
    throw new SourceObjectReservationError('identity_conflict');
  }

  if (reservation.status === 'finalized') {
    return { object: finalizedSourceObject(reservation), outcome: 'finalized' };
  }

  if (reservation.status === 'pending' && reservation.leaseExpiresAt.getTime() > now.getTime()) {
    return {
      leaseExpiresAt: reservation.leaseExpiresAt,
      outcome: 'in_progress',
      reservationId: reservation.id,
    };
  }

  if (reservation.attemptCount >= DOCUMENT_OBJECT_RESERVATION_MAX_ATTEMPTS) {
    throw new SourceObjectReservationError('retry_exhausted');
  }

  return { nextAttemptCount: reservation.attemptCount + 1, outcome: 'retry' };
}

/** Builds immutable object metadata from one finalized reservation row. */
export function finalizedSourceObject(
  reservation: DocumentObjectReservation,
): FinalizedSourceObject {
  return {
    byteLength: Number(reservation.byteLength),
    contentType: reservation.contentType,
    documentId: reservation.documentId,
    kind: reservation.kind,
    objectId: reservation.objectId,
    objectKey: reservation.objectKey,
    originalFilename: reservation.originalFilename,
    reservationId: reservation.id,
    sha256: reservation.sha256,
    storageBucket: reservation.storageBucket,
  };
}

/** Compares every field that defines immutable logical and physical object identity. */
export function matchesReservationIdentity(
  reservation: DocumentObjectReservation,
  input: PreparedSourceObject,
): boolean {
  return (
    reservation.byteLength === String(input.byteLength) &&
    reservation.contentType === input.contentType &&
    reservation.documentId === input.documentId &&
    reservation.kind === input.kind &&
    reservation.objectId === input.objectId &&
    reservation.objectKey === input.objectKey &&
    reservation.originalFilename === input.originalFilename &&
    reservation.sha256 === input.sha256 &&
    reservation.storageBucket === input.storageBucket
  );
}
