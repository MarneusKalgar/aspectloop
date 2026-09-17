import type { EntityManager } from 'typeorm';

import { randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';

import type { DocumentObject } from '../../model/document-object.entity';
import type { PreparedSourceObject, SourceObjectLease } from '../source-object-reservation.types';

import { DOCUMENT_OBJECT_RESERVATION_LEASE_MS } from './document-object-reservation.constants';
import { SourceObjectReservationError } from './source-object-reservation.errors';

interface DatabaseClockRow {
  now: unknown;
}

/** Creates a new opaque lease without exposing database timing outside the store. */
export function createSourceObjectLease(
  reservationId: string,
  attemptCount: number,
  now: Date,
): SourceObjectLease {
  return {
    attemptCount,
    leaseExpiresAt: new Date(now.getTime() + DOCUMENT_OBJECT_RESERVATION_LEASE_MS),
    leaseId: randomUUID(),
    reservationId,
  };
}

/** Narrows PostgreSQL's unique-constraint signal without trusting arbitrary errors. */
export function isPostgresUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;

  return (
    driverError !== null &&
    typeof driverError === 'object' &&
    'code' in driverError &&
    driverError.code === '23505'
  );
}

/** Compares a pre-existing immutable row with the requested canonical identity. */
export function matchesPreparedSourceObject(
  object: DocumentObject,
  input: PreparedSourceObject,
): boolean {
  return (
    object.byteLength === String(input.byteLength) &&
    object.contentType === input.contentType &&
    object.documentId === input.documentId &&
    object.id === input.objectId &&
    object.kind === input.kind &&
    object.objectKey === input.objectKey &&
    object.originalFilename === input.originalFilename &&
    object.sha256 === input.sha256 &&
    object.storageBucket === input.storageBucket
  );
}

/** Reads the database clock so lease decisions do not depend on application-host clock skew. */
export async function readDatabaseNow(manager: EntityManager): Promise<Date> {
  const rows = await manager.query<unknown>('SELECT clock_timestamp() AS "now"');

  if (!isDatabaseClockResult(rows)) {
    throw new SourceObjectReservationError('lease_lost');
  }

  const value = rows[0].now;

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new SourceObjectReservationError('lease_lost');
  }

  return value;
}

/** Narrows an arbitrary query result to the one-row database clock response. */
function isDatabaseClockResult(rows: unknown): rows is [DatabaseClockRow, ...unknown[]] {
  if (!Array.isArray(rows)) {
    return false;
  }

  const firstRow: unknown = rows[0];

  return firstRow !== null && typeof firstRow === 'object' && 'now' in firstRow;
}
