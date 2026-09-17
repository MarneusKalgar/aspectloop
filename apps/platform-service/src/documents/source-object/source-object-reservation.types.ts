import type { DocumentObjectKind } from '../model/document.constants';
import type { DocumentObjectReservationFailureCode } from './reservation/document-object-reservation.constants';

/** Caller-authorized source bytes and the identity they are allowed to claim. */
export interface CreateSourceObjectInput {
  body: Uint8Array;
  contentType: string;
  correlationId?: string;
  documentId: string;
  documentType: string;
  kind: DocumentObjectKind;
  objectId: string;
  originalFilename: string;
  ownerId: string;
  storageBucket: string;
}

/** Result of reservation acquisition, including a live conflict or recovered object. */
export type CreateSourceObjectResult =
  | {
      acquiredLease: false;
      leaseExpiresAt: Date;
      outcome: 'in_progress';
      reservationId: string;
    }
  | {
      acquiredLease: false;
      object: FinalizedSourceObject;
      outcome: 'finalized';
      recoveredUpload: false;
    }
  | {
      acquiredLease: true;
      object: FinalizedSourceObject;
      outcome: 'finalized';
      recoveredUpload: boolean;
    };

/** Immutable source-object metadata after storage bytes have been verified. */
export interface FinalizedSourceObject {
  byteLength: number;
  contentType: string;
  documentId: string;
  kind: DocumentObjectKind;
  objectId: string;
  objectKey: string;
  originalFilename: string;
  reservationId: string;
  sha256: string;
  storageBucket: string;
}

/** Canonicalized source identity used for uniqueness and integrity comparisons. */
export interface PreparedSourceObject {
  byteLength: number;
  contentType: string;
  documentId: string;
  documentType: string;
  kind: DocumentObjectKind;
  objectId: string;
  objectKey: string;
  originalFilename: string;
  ownerId: string;
  sha256: string;
  storageBucket: string;
}

/** Store-level acquisition disposition before storage I/O begins. */
export type SourceObjectAcquireResult =
  | { lease: SourceObjectLease; outcome: 'acquired' }
  | { leaseExpiresAt: Date; outcome: 'in_progress'; reservationId: string }
  | { object: FinalizedSourceObject; outcome: 'finalized' };

/** Opaque capability proving ownership of one mutable reservation attempt. */
export interface SourceObjectLease {
  attemptCount: number;
  leaseExpiresAt: Date;
  leaseId: string;
  reservationId: string;
}

/** Persistence port that serializes source-object leases and immutable finalization. */
export interface SourceObjectReservationStore {
  acquire(input: PreparedSourceObject): Promise<SourceObjectAcquireResult>;
  fail(
    reservationId: string,
    leaseId: string,
    failureCode: DocumentObjectReservationFailureCode,
  ): Promise<boolean>;
  finalize(reservationId: string, leaseId: string): Promise<FinalizedSourceObject>;
}

/** Dependency-injection token for the Platform reservation persistence port. */
export const SOURCE_OBJECT_RESERVATION_STORE = Symbol('SOURCE_OBJECT_RESERVATION_STORE');
