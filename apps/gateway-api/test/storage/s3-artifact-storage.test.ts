import type { S3Client } from '@aws-sdk/client-s3';

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { expect, test } from 'vitest';

import { ArtifactStorageError } from '../../src/storage/artifact-storage.errors';
import { S3ArtifactStorage } from '../../src/storage/s3-artifact-storage';

const OBJECT_ID = '2e49b681-0df5-46bc-91ea-c9024689755e';
const OBJECT_KEY = `documents/1f3d9a20-7304-4c6d-8f21-250f07fc9451/source/${OBJECT_ID}`;

interface StoredFixture {
  body: Uint8Array;
  contentType: string;
  sha256: string;
}

class FakeS3Client {
  private stored?: StoredFixture;

  /** Replaces stored bytes to exercise independent checksum verification. */
  corrupt(body: Uint8Array): void {
    if (!this.stored) {
      throw new Error('No fake object has been written');
    }

    this.stored = { ...this.stored, body };
  }

  /** Matches the AWS client lifecycle without owning external resources. */
  destroy(): void {
    this.stored = undefined;
  }

  /** Implements the three S3 commands used by the narrow production adapter. */
  async send(command: unknown): Promise<Record<string, unknown>> {
    if (command instanceof PutObjectCommand) {
      const body = command.input.Body;

      if (!(body instanceof Uint8Array)) {
        throw new Error('Unexpected fake PutObject body');
      }

      this.stored = {
        body,
        contentType: command.input.ContentType ?? '',
        sha256: command.input.Metadata?.sha256 ?? '',
      };

      return {};
    }

    if (!this.stored) {
      const error = new Error('Fake object absent');
      error.name = 'NotFound';
      throw error;
    }

    const output = {
      ContentLength: this.stored.body.byteLength,
      ContentType: this.stored.contentType,
      Metadata: { sha256: this.stored.sha256 },
    };

    if (command instanceof HeadObjectCommand) {
      return output;
    }

    if (command instanceof GetObjectCommand) {
      return {
        ...output,
        Body: {
          transformToByteArray: this.transformToByteArray.bind(this),
        },
      };
    }

    throw new Error('Unexpected fake S3 command');
  }

  /** Returns a defensive copy matching the SDK streaming-body contract. */
  private async transformToByteArray(): Promise<Uint8Array> {
    return new Uint8Array(this.stored?.body ?? []);
  }
}

/** Creates the production adapter around a deterministic in-memory S3 command seam. */
function createStorage(client: FakeS3Client): S3ArtifactStorage {
  return new S3ArtifactStorage(
    {
      accessKeyId: 'test-access-key',
      bucket: 'aspectloop-platform-source',
      endpoint: 'http://garage:3900',
      forcePathStyle: true,
      region: 'garage',
      requestTimeoutMs: 5000,
      secretAccessKey: 'test-secret-key',
    },
    client as unknown as S3Client,
  );
}

/** Verifies downloaded bytes are hashed independently of stored provider metadata. */
async function testRejectCorruptRead(): Promise<void> {
  const client = new FakeS3Client();
  const storage = createStorage(client);
  const metadata = await storage.writeObject({
    body: Buffer.from('original fixture'),
    contentType: 'text/plain',
    key: OBJECT_KEY,
    objectId: OBJECT_ID,
  });

  client.corrupt(Buffer.from('corrupt fixture'));

  await expect(storage.getObject(metadata)).rejects.toMatchObject<Partial<ArtifactStorageError>>({
    code: 'integrity_mismatch',
  });
}

/** Verifies application checksum metadata, readback, and accidental overwrite rejection. */
async function testWriteReadAndRejectOverwrite(): Promise<void> {
  const client = new FakeS3Client();
  const storage = createStorage(client);
  const body = Buffer.from('deterministic fixture');
  const metadata = await storage.writeObject({
    body,
    contentType: 'text/plain',
    key: OBJECT_KEY,
    objectId: OBJECT_ID,
  });

  await expect(
    storage.verifyObject({
      bucket: metadata.bucket,
      byteLength: metadata.byteLength,
      key: metadata.key,
      objectId: metadata.objectId,
      sha256: metadata.sha256,
    }),
  ).resolves.toMatchObject(metadata);
  await expect(
    storage.writeObject({ body, contentType: 'text/plain', key: OBJECT_KEY, objectId: OBJECT_ID }),
  ).rejects.toMatchObject<Partial<ArtifactStorageError>>({ code: 'already_exists' });
}

test('writes, verifies, and rejects object reuse', testWriteReadAndRejectOverwrite);
test('rejects downloaded bytes with a checksum mismatch', testRejectCorruptRead);
