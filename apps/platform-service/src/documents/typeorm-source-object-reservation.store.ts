import type { EntityManager } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import type { DocumentObjectReservationFailureCode } from './document-object-reservation.constants';
import type {
  FinalizedSourceObject,
  PreparedSourceObject,
  SourceObjectAcquireResult,
  SourceObjectReservationStore,
} from './source-object-reservation.types';

import { DOCUMENT_OBJECT_RESERVATION_LEASE_MS } from './document-object-reservation.constants';
import { DocumentObjectReservation } from './document-object-reservation.entity';
import { DocumentObject } from './document-object.entity';
import { Document } from './document.entity';
import { SourceObjectReservationError } from './source-object-reservation.errors';
import {
  decideExistingReservation,
  finalizedSourceObject,
} from './source-object-reservation.state';
import {
  createSourceObjectLease,
  isPostgresUniqueViolation,
  matchesPreparedSourceObject,
  readDatabaseNow,
} from './typeorm-source-object-reservation.utils';

@Injectable()
export class TypeOrmSourceObjectReservationStore implements SourceObjectReservationStore {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Acquires the unique logical source lease or reports the locked row's durable state.
   *
   * @param input Canonical source identity and integrity metadata.
   * @returns Lease, in-progress state, or finalized metadata.
   */
  async acquire(input: PreparedSourceObject): Promise<SourceObjectAcquireResult> {
    try {
      return await this.dataSource.transaction((manager) =>
        this.acquireInTransaction(manager, input),
      );
    } catch (error) {
      if (!isPostgresUniqueViolation(error)) {
        throw error;
      }

      return this.dataSource.transaction((manager) =>
        this.acquireExistingInTransaction(manager, input),
      );
    }
  }

  /** Marks a known upload failure only while the caller still owns the current lease. */
  async fail(
    reservationId: string,
    leaseId: string,
    failureCode: DocumentObjectReservationFailureCode,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DocumentObjectReservation);
      const reservation = await repository.findOne({
        lock: { mode: 'pessimistic_write' },
        where: { id: reservationId },
      });

      if (reservation?.status !== 'pending' || reservation.leaseId !== leaseId) {
        return false;
      }

      reservation.failureCode = failureCode;
      reservation.finalizedAt = null;
      reservation.status = 'failed';
      await repository.save(reservation);

      return true;
    });
  }

  /** Inserts immutable metadata and finalizes only the caller's current reservation lease. */
  async finalize(reservationId: string, leaseId: string): Promise<FinalizedSourceObject> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DocumentObjectReservation);
      const reservation = await repository.findOne({
        lock: { mode: 'pessimistic_write' },
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new SourceObjectReservationError('lease_lost');
      }

      if (reservation.status === 'finalized') {
        return finalizedSourceObject(reservation);
      }

      if (reservation.status !== 'pending' || reservation.leaseId !== leaseId) {
        throw new SourceObjectReservationError('lease_lost');
      }

      await manager.getRepository(DocumentObject).insert({
        byteLength: reservation.byteLength,
        contentType: reservation.contentType,
        documentId: reservation.documentId,
        id: reservation.objectId,
        kind: reservation.kind,
        objectKey: reservation.objectKey,
        originalFilename: reservation.originalFilename,
        sha256: reservation.sha256,
        storageBucket: reservation.storageBucket,
      });
      await manager
        .getRepository(Document)
        .update({ id: reservation.documentId }, { status: 'source_stored' });

      reservation.failureCode = null;
      reservation.finalizedAt = await readDatabaseNow(manager);
      reservation.status = 'finalized';
      await repository.save(reservation);

      return finalizedSourceObject(reservation);
    });
  }

  /** Reloads the winner after an insert-time uniqueness race. */
  private async acquireExistingInTransaction(
    manager: EntityManager,
    input: PreparedSourceObject,
  ): Promise<SourceObjectAcquireResult> {
    await this.assertDocument(manager, input);
    const existing = await this.findConflictingReservation(manager, input);

    if (!existing) {
      throw new SourceObjectReservationError('identity_conflict');
    }

    return this.decideAndApplyExisting(manager, existing, input);
  }

  /** Inserts a first lease or evaluates a matching locked reservation. */
  private async acquireInTransaction(
    manager: EntityManager,
    input: PreparedSourceObject,
  ): Promise<SourceObjectAcquireResult> {
    await this.assertDocument(manager, input);
    const existing = await this.findConflictingReservation(manager, input);

    if (existing) {
      return this.decideAndApplyExisting(manager, existing, input);
    }

    const finalizedObject = await this.findConflictingObject(manager, input);

    if (finalizedObject) {
      return this.adoptFinalizedObject(manager, finalizedObject, input);
    }

    return this.insertPendingReservation(manager, input);
  }

  /** Adopts matching pre-reservation immutable metadata without rewriting its object bytes. */
  private async adoptFinalizedObject(
    manager: EntityManager,
    object: DocumentObject,
    input: PreparedSourceObject,
  ): Promise<SourceObjectAcquireResult> {
    if (!matchesPreparedSourceObject(object, input)) {
      throw new SourceObjectReservationError('identity_conflict');
    }

    const now = await readDatabaseNow(manager);
    const reservation = manager.getRepository(DocumentObjectReservation).create({
      attemptCount: 1,
      byteLength: object.byteLength,
      contentType: object.contentType,
      createdAt: now,
      documentId: object.documentId,
      failureCode: null,
      finalizedAt: now,
      id: randomUUID(),
      kind: object.kind,
      leaseExpiresAt: new Date(now.getTime() + DOCUMENT_OBJECT_RESERVATION_LEASE_MS),
      leaseId: randomUUID(),
      objectId: object.id,
      objectKey: object.objectKey,
      originalFilename: object.originalFilename,
      sha256: object.sha256,
      status: 'finalized',
      storageBucket: object.storageBucket,
      updatedAt: now,
    });
    await manager.getRepository(DocumentObjectReservation).insert(reservation);

    return { object: finalizedSourceObject(reservation), outcome: 'finalized' };
  }

  /** Rejects a document ID whose owner or registry type differs from the request. */
  private async assertDocument(manager: EntityManager, input: PreparedSourceObject): Promise<void> {
    const document = await manager.getRepository(Document).findOneBy({ id: input.documentId });

    if (document?.ownerId !== input.ownerId || document.documentType !== input.documentType) {
      throw new SourceObjectReservationError('document_mismatch');
    }
  }

  /** Applies a pure state decision while the existing reservation remains locked. */
  private async decideAndApplyExisting(
    manager: EntityManager,
    reservation: DocumentObjectReservation,
    input: PreparedSourceObject,
  ): Promise<SourceObjectAcquireResult> {
    const now = await readDatabaseNow(manager);
    const decision = decideExistingReservation(reservation, input, now);

    if (decision.outcome !== 'retry') {
      return decision;
    }

    const lease = createSourceObjectLease(reservation.id, decision.nextAttemptCount, now);
    reservation.attemptCount = lease.attemptCount;
    reservation.failureCode = null;
    reservation.finalizedAt = null;
    reservation.leaseExpiresAt = lease.leaseExpiresAt;
    reservation.leaseId = lease.leaseId;
    reservation.status = 'pending';
    await manager.getRepository(DocumentObjectReservation).save(reservation);

    return { lease, outcome: 'acquired' };
  }

  /**
   * Finds immutable metadata without requesting a row lock that would require UPDATE privilege.
   * Reservation uniqueness remains the concurrency authority when this row must be adopted.
   */
  private findConflictingObject(
    manager: EntityManager,
    input: PreparedSourceObject,
  ): Promise<DocumentObject | null> {
    return manager.getRepository(DocumentObject).findOne({
      where: [
        { documentId: input.documentId, kind: input.kind },
        { id: input.objectId },
        { objectKey: input.objectKey, storageBucket: input.storageBucket },
      ],
    });
  }

  /** Finds any reservation that claims the requested logical, object, or storage identity. */
  private findConflictingReservation(
    manager: EntityManager,
    input: PreparedSourceObject,
  ): Promise<DocumentObjectReservation | null> {
    return manager.getRepository(DocumentObjectReservation).findOne({
      lock: { mode: 'pessimistic_write' },
      where: [
        { documentId: input.documentId, kind: input.kind },
        { objectId: input.objectId },
        { objectKey: input.objectKey, storageBucket: input.storageBucket },
      ],
    });
  }

  /** Inserts the first pending reservation with an opaque, bounded lease. */
  private async insertPendingReservation(
    manager: EntityManager,
    input: PreparedSourceObject,
  ): Promise<SourceObjectAcquireResult> {
    const now = await readDatabaseNow(manager);
    const reservationId = randomUUID();
    const lease = createSourceObjectLease(reservationId, 1, now);
    await manager.getRepository(DocumentObjectReservation).insert({
      attemptCount: lease.attemptCount,
      byteLength: String(input.byteLength),
      contentType: input.contentType,
      documentId: input.documentId,
      failureCode: null,
      finalizedAt: null,
      id: reservationId,
      kind: input.kind,
      leaseExpiresAt: lease.leaseExpiresAt,
      leaseId: lease.leaseId,
      objectId: input.objectId,
      objectKey: input.objectKey,
      originalFilename: input.originalFilename,
      sha256: input.sha256,
      status: 'pending',
      storageBucket: input.storageBucket,
    });

    return { lease, outcome: 'acquired' };
  }
}
