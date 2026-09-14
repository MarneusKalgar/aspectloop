import { Inject, Injectable } from '@nestjs/common';

import type { ArtifactStorage } from '../storage/artifact-storage.port';
import type {
  CreateSourceObjectInput,
  CreateSourceObjectResult,
  FinalizedSourceObject,
  PreparedSourceObject,
  SourceObjectLease,
  SourceObjectReservationStore,
} from './source-object-reservation.types';

import { ArtifactStorageError } from '../storage/artifact-storage.errors';
import { ARTIFACT_STORAGE } from '../storage/artifact-storage.port';
import { SourceObjectReservationError } from './source-object-reservation.errors';
import { SOURCE_OBJECT_RESERVATION_STORE } from './source-object-reservation.types';
import { prepareSourceObject, toReservationFailureCode } from './source-object.utils';

@Injectable()
export class SourceObjectCoordinator {
  constructor(
    @Inject(SOURCE_OBJECT_RESERVATION_STORE)
    private readonly reservations: SourceObjectReservationStore,
    @Inject(ARTIFACT_STORAGE) private readonly storage: ArtifactStorage,
  ) {}

  /**
   * Coordinates one source-object write without spanning storage I/O with a database transaction.
   *
   * @param input Validated document identity, display metadata, and source bytes.
   * @returns Finalized metadata or the current live-lease state.
   */
  async createSourceObject(input: CreateSourceObjectInput): Promise<CreateSourceObjectResult> {
    const prepared = prepareSourceObject(input);
    const acquired = await this.reservations.acquire(prepared);

    if (acquired.outcome === 'in_progress') {
      return { acquiredLease: false, ...acquired };
    }

    if (acquired.outcome === 'finalized') {
      await this.verifyFinalizedObject(acquired.object, input.correlationId);

      return {
        acquiredLease: false,
        object: acquired.object,
        outcome: 'finalized',
        recoveredUpload: false,
      };
    }

    const recoveredUpload = await this.writeOrRecover(prepared, input, acquired.lease);
    const object = await this.reservations.finalize(
      acquired.lease.reservationId,
      acquired.lease.leaseId,
    );

    return { acquiredLease: true, object, outcome: 'finalized', recoveredUpload };
  }

  /** Persists a bounded storage failure only if the caller still owns the lease. */
  private async failLease(lease: SourceObjectLease, error: unknown): Promise<void> {
    await this.reservations.fail(
      lease.reservationId,
      lease.leaseId,
      toReservationFailureCode(error),
    );
  }

  /** Verifies that finalized database metadata still identifies the authoritative bytes. */
  private async verifyFinalizedObject(
    object: FinalizedSourceObject,
    correlationId?: string,
  ): Promise<void> {
    try {
      await this.storage.verifyObject({
        bucket: object.storageBucket,
        byteLength: object.byteLength,
        correlationId,
        key: object.objectKey,
        objectId: object.objectId,
        sha256: object.sha256,
      });
    } catch (error) {
      if (error instanceof ArtifactStorageError && error.code === 'integrity_mismatch') {
        throw new SourceObjectReservationError('recovery_required');
      }

      throw new SourceObjectReservationError('storage_failure');
    }
  }

  /** Writes new bytes or verifies bytes left by an expired lease holder. */
  private async writeOrRecover(
    prepared: PreparedSourceObject,
    input: CreateSourceObjectInput,
    lease: SourceObjectLease,
  ): Promise<boolean> {
    let recoveredUpload = false;

    try {
      await this.storage.writeObject({
        body: input.body,
        contentType: prepared.contentType,
        correlationId: input.correlationId,
        key: prepared.objectKey,
        objectId: prepared.objectId,
      });
    } catch (error) {
      if (error instanceof ArtifactStorageError && error.code === 'already_exists') {
        recoveredUpload = true;
      } else {
        await this.failLease(lease, error);
        throw new SourceObjectReservationError('storage_failure');
      }
    }

    try {
      await this.storage.verifyObject({
        bucket: prepared.storageBucket,
        byteLength: prepared.byteLength,
        correlationId: input.correlationId,
        key: prepared.objectKey,
        objectId: prepared.objectId,
        sha256: prepared.sha256,
      });
    } catch (error) {
      await this.failLease(lease, error);

      if (error instanceof ArtifactStorageError && error.code === 'integrity_mismatch') {
        throw new SourceObjectReservationError('recovery_required');
      }

      throw new SourceObjectReservationError('storage_failure');
    }

    return recoveredUpload;
  }
}
