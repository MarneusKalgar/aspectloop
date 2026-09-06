import type { GetObjectCommandOutput, HeadObjectCommandOutput } from '@aws-sdk/client-s3';

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { ArtifactStorageOperation } from './artifact-storage.errors';
import type { ArtifactStorage } from './artifact-storage.port';
import type {
  ArtifactObject,
  ArtifactObjectIdentity,
  ArtifactObjectLocation,
  ArtifactObjectMetadata,
  ArtifactOperationContext,
  VerifyArtifactObjectInput,
  WriteArtifactObjectInput,
} from './artifact-storage.types';

import { PLATFORM_SOURCE_BUCKET_ROLE } from '../documents/document.constants';
import {
  CORRELATION_ID_PATTERN,
  MAX_CONTENT_TYPE_LENGTH,
  S3_BUCKET_NAME_PATTERN,
  SHA256_PATTERN,
  SOURCE_OBJECT_KEY_PATTERN,
  UUID_PATTERN,
} from './artifact-storage.constants';
import { ArtifactStorageError } from './artifact-storage.errors';

export interface S3ArtifactStorageOptions {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  region: string;
  requestTimeoutMs: number;
  secretAccessKey: string;
}

type S3ObjectOutput = GetObjectCommandOutput | HeadObjectCommandOutput;

@Injectable()
export class S3ArtifactStorage implements ArtifactStorage, OnModuleDestroy {
  private readonly client: S3Client;
  private readonly logger = new Logger(S3ArtifactStorage.name);

  constructor(
    private readonly options: S3ArtifactStorageOptions,
    client?: S3Client,
  ) {
    this.client = client ?? createClient(options);
  }

  /**
   * Fetches one private object and validates its provider metadata and checksum.
   *
   * @param location Owned object location.
   * @param context Optional correlation context.
   * @returns Object bytes plus validated metadata.
   */
  async getObject(
    location: ArtifactObjectLocation,
    context: ArtifactOperationContext = {},
  ): Promise<ArtifactObject> {
    const startedAt = Date.now();

    try {
      this.assertLocation(location, 'get');
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: location.bucket, Key: location.key }),
        { abortSignal: AbortSignal.timeout(this.options.requestTimeoutMs) },
      );

      if (!response.Body) {
        throw new ArtifactStorageError('invalid_response', 'get');
      }

      const body = await response.Body.transformToByteArray();
      const metadata = this.metadata(location, response, 'get');

      if (body.byteLength !== metadata.byteLength || digest(body) !== metadata.sha256) {
        throw new ArtifactStorageError('integrity_mismatch', 'get');
      }

      this.logSuccess('get', location.objectId, metadata.byteLength, context, startedAt);

      return { ...metadata, body };
    } catch (error) {
      throw this.logAndMapFailure(error, 'get', location.objectId, context, startedAt);
    }
  }

  /**
   * Reads provider metadata for one private object without loading its body.
   *
   * @param location Owned object location.
   * @param context Optional correlation context.
   * @returns Validated object metadata.
   */
  async headObject(
    location: ArtifactObjectLocation,
    context: ArtifactOperationContext = {},
  ): Promise<ArtifactObjectMetadata> {
    const startedAt = Date.now();

    try {
      this.assertLocation(location, 'head');
      const metadata = await this.head(location, 'head');
      this.logSuccess('head', location.objectId, metadata.byteLength, context, startedAt);

      return metadata;
    } catch (error) {
      throw this.logAndMapFailure(error, 'head', location.objectId, context, startedAt);
    }
  }

  /** Releases sockets owned by the AWS SDK client during Nest shutdown. */
  onModuleDestroy(): void {
    this.client.destroy();
  }

  /**
   * Fetches an object and compares it with database-authoritative size and checksum values.
   *
   * @param input Expected owned location and integrity metadata.
   * @returns Provider metadata after complete body verification.
   */
  async verifyObject(input: VerifyArtifactObjectInput): Promise<ArtifactObjectMetadata> {
    const startedAt = Date.now();

    try {
      this.assertLocation(input, 'verify');
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
        { abortSignal: AbortSignal.timeout(this.options.requestTimeoutMs) },
      );

      if (!response.Body) {
        throw new ArtifactStorageError('invalid_response', 'verify');
      }

      const body = await response.Body.transformToByteArray();
      const metadata = this.metadata(input, response, 'verify');
      const actualSha256 = digest(body);

      if (
        body.byteLength !== metadata.byteLength ||
        actualSha256 !== metadata.sha256 ||
        metadata.byteLength !== input.byteLength ||
        metadata.sha256 !== input.sha256
      ) {
        throw new ArtifactStorageError('integrity_mismatch', 'verify');
      }

      this.logSuccess('verify', input.objectId, metadata.byteLength, input, startedAt);

      return metadata;
    } catch (error) {
      throw this.logAndMapFailure(error, 'verify', input.objectId, input, startedAt);
    }
  }

  /**
   * Writes a new immutable object after rejecting an existing key.
   *
   * @param input Stable object identity, bytes, and validated content type.
   * @returns Persistable location and application integrity metadata.
   */
  async writeObject(input: WriteArtifactObjectInput): Promise<ArtifactObjectMetadata> {
    const startedAt = Date.now();

    try {
      this.assertIdentity(input, 'write');

      if (
        input.body.byteLength === 0 ||
        input.contentType.trim().length === 0 ||
        input.contentType.length > MAX_CONTENT_TYPE_LENGTH
      ) {
        throw new ArtifactStorageError('invalid_response', 'write');
      }

      const location = { bucket: this.options.bucket, key: input.key, objectId: input.objectId };
      let objectExists = false;

      try {
        await this.head(location, 'write');
        objectExists = true;
      } catch (error) {
        const mappedError = this.mapError(error, 'write');

        if (mappedError.code !== 'not_found') {
          throw mappedError;
        }
      }

      if (objectExists) {
        throw new ArtifactStorageError('already_exists', 'write');
      }

      const sha256 = digest(input.body);
      await this.client.send(
        new PutObjectCommand({
          Body: input.body,
          Bucket: this.options.bucket,
          ContentLength: input.body.byteLength,
          ContentType: input.contentType,
          IfNoneMatch: '*',
          Key: input.key,
          Metadata: { sha256 },
        }),
        { abortSignal: AbortSignal.timeout(this.options.requestTimeoutMs) },
      );

      const metadata = {
        ...location,
        byteLength: input.body.byteLength,
        contentType: input.contentType,
        sha256,
      };
      this.logSuccess('write', input.objectId, input.body.byteLength, input, startedAt);

      return metadata;
    } catch (error) {
      throw this.logAndMapFailure(error, 'write', input.objectId, input, startedAt);
    }
  }

  /** Validates bounded identifiers before they can reach logs or the S3 request. */
  private assertIdentity(
    identity: ArtifactObjectIdentity,
    operation: ArtifactStorageOperation,
  ): void {
    if (
      !S3_BUCKET_NAME_PATTERN.test(this.options.bucket) ||
      !UUID_PATTERN.test(identity.objectId) ||
      !SOURCE_OBJECT_KEY_PATTERN.test(identity.key) ||
      !identity.key.endsWith(`/source/${identity.objectId}`)
    ) {
      throw new ArtifactStorageError('invalid_location', operation);
    }
  }

  /** Validates that a read cannot escape the configured platform source bucket. */
  private assertLocation(
    location: ArtifactObjectLocation,
    operation: ArtifactStorageOperation,
  ): void {
    this.assertIdentity(location, operation);

    if (location.bucket !== this.options.bucket) {
      throw new ArtifactStorageError('invalid_location', operation);
    }
  }

  /** Returns a bounded correlation identifier or omits unsafe diagnostic input. */
  private correlationId(context: ArtifactOperationContext): string | undefined {
    return context.correlationId && CORRELATION_ID_PATTERN.test(context.correlationId)
      ? context.correlationId
      : undefined;
  }

  /** Sends one private HeadObject request and validates the returned metadata. */
  private async head(
    location: ArtifactObjectLocation,
    operation: ArtifactStorageOperation,
  ): Promise<ArtifactObjectMetadata> {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: location.bucket, Key: location.key }),
      { abortSignal: AbortSignal.timeout(this.options.requestTimeoutMs) },
    );

    return this.metadata(location, response, operation);
  }

  /** Maps and logs an SDK failure without exposing request details or object keys. */
  private logAndMapFailure(
    error: unknown,
    operation: ArtifactStorageOperation,
    objectId: string,
    context: ArtifactOperationContext,
    startedAt: number,
  ): ArtifactStorageError {
    const mappedError = this.mapError(error, operation);
    this.logger.error({
      bucketRole: PLATFORM_SOURCE_BUCKET_ROLE,
      correlationId: this.correlationId(context),
      durationMs: Date.now() - startedAt,
      errorCode: mappedError.code,
      event: 'artifact.storage.operation',
      objectId: UUID_PATTERN.test(objectId) ? objectId : undefined,
      operation,
      outcome: 'failure',
    });

    return mappedError;
  }

  /** Emits only the bounded storage telemetry allowed by the M04 contract. */
  private logSuccess(
    operation: ArtifactStorageOperation,
    objectId: string,
    byteLength: number,
    context: ArtifactOperationContext,
    startedAt: number,
  ): void {
    this.logger.log({
      bucketRole: PLATFORM_SOURCE_BUCKET_ROLE,
      byteLength,
      correlationId: this.correlationId(context),
      durationMs: Date.now() - startedAt,
      event: 'artifact.storage.operation',
      objectId,
      operation,
      outcome: 'success',
    });
  }

  /** Converts SDK and timeout failures into the bounded application error vocabulary. */
  private mapError(error: unknown, operation: ArtifactStorageOperation): ArtifactStorageError {
    if (error instanceof ArtifactStorageError) {
      return error;
    }

    const status = this.statusCode(error);
    const name = error instanceof Error ? error.name : '';

    if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') {
      return new ArtifactStorageError('not_found', operation);
    }

    if (status === 409 || status === 412 || name === 'PreconditionFailed') {
      return new ArtifactStorageError('already_exists', operation);
    }

    return new ArtifactStorageError('unavailable', operation);
  }

  /** Builds domain-neutral metadata and rejects incomplete provider responses. */
  private metadata(
    location: ArtifactObjectLocation,
    output: S3ObjectOutput,
    operation: ArtifactStorageOperation,
  ): ArtifactObjectMetadata {
    const byteLength = output.ContentLength;
    const contentType = output.ContentType;
    const sha256 = output.Metadata?.sha256;

    if (
      byteLength === undefined ||
      !Number.isSafeInteger(byteLength) ||
      byteLength <= 0 ||
      !contentType ||
      contentType.length > MAX_CONTENT_TYPE_LENGTH ||
      !sha256 ||
      !SHA256_PATTERN.test(sha256)
    ) {
      throw new ArtifactStorageError('invalid_response', operation);
    }

    return { ...location, byteLength, contentType, sha256 };
  }

  /** Extracts only the numeric HTTP status from an SDK error object. */
  private statusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('$metadata' in error)) {
      return undefined;
    }

    const metadata = error.$metadata;

    if (!metadata || typeof metadata !== 'object' || !('httpStatusCode' in metadata)) {
      return undefined;
    }

    return typeof metadata.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
  }
}

/** Creates an explicit S3 client without ambient credentials or automatic retries. */
function createClient(options: S3ArtifactStorageOptions): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
    maxAttempts: 1,
    region: options.region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/** Computes the application checksum independently of provider ETag behavior. */
function digest(body: Uint8Array): string {
  return createHash('sha256').update(body).digest('hex');
}
