import type { DocumentObjectReservation } from '@platform/documents/model/document-object-reservation.entity';
import type {
  CreateSourceObjectInput,
  FinalizedSourceObject,
  PreparedSourceObject,
  SourceObjectAcquireResult,
  SourceObjectReservationStore,
} from '@platform/documents/source-object/source-object-reservation.types';
import type { ArtifactStorage } from '@platform/storage/artifact-storage.port';
import type {
  ArtifactObject,
  ArtifactObjectMetadata,
  VerifyArtifactObjectInput,
  WriteArtifactObjectInput,
} from '@platform/storage/artifact-storage.types';

import { SourceObjectReservationError } from '@platform/documents/source-object/reservation/source-object-reservation.errors';
import { decideExistingReservation } from '@platform/documents/source-object/reservation/source-object-reservation.state';
import { SourceObjectCoordinator } from '@platform/documents/source-object/source-object-coordinator';
import { ArtifactStorageError } from '@platform/storage/artifact-storage.errors';
import { expect, test, vi } from 'vitest';

const DOCUMENT_ID = '1f3d9a20-7304-4c6d-8f21-250f07fc9451';
const LEASE_ID = '8f57e8a2-1efe-4d78-b170-68db54fb4f43';
const OBJECT_ID = '2e49b681-0df5-46bc-91ea-c9024689755e';
const OWNER_ID = '5f1a0b4e-7c2d-4e9f-8a31-6b2c9d0e4f10';
const RESERVATION_ID = '54f6e067-6655-45a8-a99e-e68584db403d';
const BODY = Buffer.from('reservation fixture');
const OBJECT_KEY = `documents/${DOCUMENT_ID}/source/${OBJECT_ID}`;

const PREPARED: PreparedSourceObject = {
  byteLength: BODY.byteLength,
  contentType: 'text/plain',
  documentId: DOCUMENT_ID,
  documentType: 'supplier_invoice',
  kind: 'source',
  objectId: OBJECT_ID,
  objectKey: OBJECT_KEY,
  originalFilename: 'source.txt',
  ownerId: OWNER_ID,
  sha256: '830674d5ad5009d763d19cbc5c50983c211201f759b9086156e9d67736f1b2b9',
  storageBucket: 'aspectloop-platform-source',
};

const FINALIZED: FinalizedSourceObject = {
  byteLength: PREPARED.byteLength,
  contentType: PREPARED.contentType,
  documentId: PREPARED.documentId,
  kind: PREPARED.kind,
  objectId: PREPARED.objectId,
  objectKey: PREPARED.objectKey,
  originalFilename: PREPARED.originalFilename,
  reservationId: RESERVATION_ID,
  sha256: PREPARED.sha256,
  storageBucket: PREPARED.storageBucket,
};

class FakeArtifactStorage implements ArtifactStorage {
  verifyError?: ArtifactStorageError;
  readonly verifyObject = vi.fn(this.verify.bind(this));
  writeError?: ArtifactStorageError;
  readonly writeObject = vi.fn(this.write.bind(this));

  constructor(private readonly reservations: FakeReservationStore) {}

  /** Provides the complete interface without introducing unrelated read behavior. */
  async getObject(): Promise<ArtifactObject> {
    throw new Error('Unexpected getObject call');
  }

  /** Provides the complete interface without introducing unrelated head behavior. */
  async headObject(): Promise<ArtifactObjectMetadata> {
    throw new Error('Unexpected headObject call');
  }

  /** Verifies storage is called only after the acquisition transaction completed. */
  private async verify(input: VerifyArtifactObjectInput): Promise<ArtifactObjectMetadata> {
    expect(this.reservations.databaseCallActive).toBe(false);

    if (this.verifyError) {
      throw this.verifyError;
    }

    return {
      bucket: input.bucket,
      byteLength: input.byteLength,
      contentType: PREPARED.contentType,
      key: input.key,
      objectId: input.objectId,
      sha256: input.sha256,
    };
  }

  /** Simulates either a successful new write or a provider already-exists response. */
  private async write(input: WriteArtifactObjectInput): Promise<ArtifactObjectMetadata> {
    expect(this.reservations.databaseCallActive).toBe(false);

    if (this.writeError) {
      throw this.writeError;
    }

    return {
      bucket: PREPARED.storageBucket,
      byteLength: input.body.byteLength,
      contentType: input.contentType,
      key: input.key,
      objectId: input.objectId,
      sha256: PREPARED.sha256,
    };
  }
}

class FakeReservationStore implements SourceObjectReservationStore {
  databaseCallActive = false;
  readonly fail = vi.fn<SourceObjectReservationStore['fail']>().mockResolvedValue(true);
  readonly finalize = vi
    .fn<SourceObjectReservationStore['finalize']>()
    .mockResolvedValue(FINALIZED);

  constructor(private readonly acquired: SourceObjectAcquireResult) {}

  /** Simulates a short committed acquisition transaction. */
  async acquire(): Promise<SourceObjectAcquireResult> {
    this.databaseCallActive = true;
    await Promise.resolve();
    this.databaseCallActive = false;

    return this.acquired;
  }
}

/** Builds the application command whose digest matches the prepared fixture. */
function command(): CreateSourceObjectInput {
  return {
    body: BODY,
    contentType: PREPARED.contentType,
    documentId: PREPARED.documentId,
    documentType: PREPARED.documentType,
    kind: PREPARED.kind,
    objectId: PREPARED.objectId,
    originalFilename: PREPARED.originalFilename,
    ownerId: PREPARED.ownerId,
    storageBucket: PREPARED.storageBucket,
  };
}

/** Creates an entity-shaped state snapshot for pure reservation decisions. */
function reservation(
  overrides: Partial<DocumentObjectReservation> = {},
): DocumentObjectReservation {
  return {
    attemptCount: 1,
    byteLength: String(PREPARED.byteLength),
    contentType: PREPARED.contentType,
    createdAt: new Date('2026-09-13T00:00:00.000Z'),
    documentId: PREPARED.documentId,
    failureCode: null,
    finalizedAt: null,
    id: RESERVATION_ID,
    kind: PREPARED.kind,
    leaseExpiresAt: new Date('2026-09-13T00:01:00.000Z'),
    leaseId: LEASE_ID,
    objectId: PREPARED.objectId,
    objectKey: PREPARED.objectKey,
    originalFilename: PREPARED.originalFilename,
    sha256: PREPARED.sha256,
    status: 'pending',
    storageBucket: PREPARED.storageBucket,
    updatedAt: new Date('2026-09-13T00:00:00.000Z'),
    ...overrides,
  } as DocumentObjectReservation;
}

/** Verifies the coordinator writes, verifies, and finalizes outside acquisition. */
async function testCreateAndFinalize(): Promise<void> {
  const store = new FakeReservationStore({
    lease: {
      attemptCount: 1,
      leaseExpiresAt: new Date('2026-09-13T00:01:00.000Z'),
      leaseId: LEASE_ID,
      reservationId: RESERVATION_ID,
    },
    outcome: 'acquired',
  });
  const storage = new FakeArtifactStorage(store);
  const result = await new SourceObjectCoordinator(store, storage).createSourceObject(command());

  expect(result).toMatchObject({ acquiredLease: true, outcome: 'finalized' });
  expect(storage.writeObject).toHaveBeenCalledOnce();
  expect(storage.verifyObject).toHaveBeenCalledOnce();
  expect(store.finalize).toHaveBeenCalledWith(RESERVATION_ID, LEASE_ID);
}

/** Verifies mismatched content cannot reuse an existing logical reservation. */
function testIdentityConflict(): void {
  expect(() =>
    decideExistingReservation(
      reservation(),
      { ...PREPARED, sha256: '0'.repeat(64) },
      new Date('2026-09-13T00:00:30.000Z'),
    ),
  ).toThrowError(
    expect.objectContaining<Partial<SourceObjectReservationError>>({
      code: 'identity_conflict',
    }),
  );
}

/** Verifies a crashed writer's matching bytes are reconciled instead of overwritten. */
async function testRecoverExistingUpload(): Promise<void> {
  const store = new FakeReservationStore({
    lease: {
      attemptCount: 2,
      leaseExpiresAt: new Date('2026-09-13T00:02:00.000Z'),
      leaseId: LEASE_ID,
      reservationId: RESERVATION_ID,
    },
    outcome: 'acquired',
  });
  const storage = new FakeArtifactStorage(store);
  storage.writeError = new ArtifactStorageError('already_exists', 'write');
  const result = await new SourceObjectCoordinator(store, storage).createSourceObject(command());

  expect(result).toMatchObject({
    acquiredLease: true,
    outcome: 'finalized',
    recoveredUpload: true,
  });
  expect(storage.verifyObject).toHaveBeenCalledOnce();
  expect(store.fail).not.toHaveBeenCalled();
}

/** Verifies mismatched crash-recovery bytes fail closed and persist a bounded failure. */
async function testRejectMismatchedRecovery(): Promise<void> {
  const store = new FakeReservationStore({
    lease: {
      attemptCount: 2,
      leaseExpiresAt: new Date('2026-09-13T00:02:00.000Z'),
      leaseId: LEASE_ID,
      reservationId: RESERVATION_ID,
    },
    outcome: 'acquired',
  });
  const storage = new FakeArtifactStorage(store);
  storage.writeError = new ArtifactStorageError('already_exists', 'write');
  storage.verifyError = new ArtifactStorageError('integrity_mismatch', 'verify');

  await expect(
    new SourceObjectCoordinator(store, storage).createSourceObject(command()),
  ).rejects.toMatchObject<Partial<SourceObjectReservationError>>({
    code: 'recovery_required',
  });
  expect(store.fail).toHaveBeenCalledWith(RESERVATION_ID, LEASE_ID, 'integrity_mismatch');
  expect(store.finalize).not.toHaveBeenCalled();
}

/** Verifies live leases block peers while expired and failed leases advance attempts. */
function testReservationDecisions(): void {
  const now = new Date('2026-09-13T00:00:30.000Z');

  expect(decideExistingReservation(reservation(), PREPARED, now)).toMatchObject({
    outcome: 'in_progress',
    reservationId: RESERVATION_ID,
  });
  expect(
    decideExistingReservation(
      reservation({ leaseExpiresAt: new Date('2026-09-12T23:59:00.000Z') }),
      PREPARED,
      now,
    ),
  ).toEqual({ nextAttemptCount: 2, outcome: 'retry' });
  expect(
    decideExistingReservation(
      reservation({ failureCode: 'unavailable', status: 'failed' }),
      PREPARED,
      now,
    ),
  ).toEqual({ nextAttemptCount: 2, outcome: 'retry' });
}

test('decides live, expired, and failed reservation states', testReservationDecisions);
test('rejects conflicting immutable source identity', testIdentityConflict);
test('coordinates storage outside database acquisition and finalizes', testCreateAndFinalize);
test('reconciles a matching upload left by an expired writer', testRecoverExistingUpload);
test('rejects mismatched bytes left by an expired writer', testRejectMismatchedRecovery);
