import type { DocumentObjectReservationFailureCode } from './document-object-reservation.constants';
import type { DocumentObjectKind } from './document.constants';

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

export type SourceObjectAcquireResult =
  | { lease: SourceObjectLease; outcome: 'acquired' }
  | { leaseExpiresAt: Date; outcome: 'in_progress'; reservationId: string }
  | { object: FinalizedSourceObject; outcome: 'finalized' };

export interface SourceObjectLease {
  attemptCount: number;
  leaseExpiresAt: Date;
  leaseId: string;
  reservationId: string;
}

export interface SourceObjectReservationStore {
  acquire(input: PreparedSourceObject): Promise<SourceObjectAcquireResult>;
  fail(
    reservationId: string,
    leaseId: string,
    failureCode: DocumentObjectReservationFailureCode,
  ): Promise<boolean>;
  finalize(reservationId: string, leaseId: string): Promise<FinalizedSourceObject>;
}

export const SOURCE_OBJECT_RESERVATION_STORE = Symbol('SOURCE_OBJECT_RESERVATION_STORE');
