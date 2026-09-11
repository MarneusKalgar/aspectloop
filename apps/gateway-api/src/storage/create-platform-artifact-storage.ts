import type { EnvironmentVariables } from '../config/env.schema';

import { S3ArtifactStorage } from './s3-artifact-storage';

type PlatformArtifactStorageEnvironment = Pick<
  EnvironmentVariables,
  | 'PLATFORM_S3_ACCESS_KEY_ID'
  | 'PLATFORM_S3_BUCKET'
  | 'PLATFORM_S3_SECRET_ACCESS_KEY'
  | 'S3_ENDPOINT'
  | 'S3_FORCE_PATH_STYLE'
  | 'S3_REGION'
  | 'S3_REQUEST_TIMEOUT_MS'
>;

/**
 * Creates the gateway platform-source adapter from validated environment values.
 *
 * @param environment Validated gateway environment.
 * @returns Configured S3-compatible artifact adapter.
 */
export function createPlatformArtifactStorage(
  environment: PlatformArtifactStorageEnvironment,
): S3ArtifactStorage {
  return new S3ArtifactStorage({
    accessKeyId: environment.PLATFORM_S3_ACCESS_KEY_ID,
    bucket: environment.PLATFORM_S3_BUCKET,
    endpoint: environment.S3_ENDPOINT,
    forcePathStyle: environment.S3_FORCE_PATH_STYLE === 'true',
    region: environment.S3_REGION,
    requestTimeoutMs: environment.S3_REQUEST_TIMEOUT_MS,
    secretAccessKey: environment.PLATFORM_S3_SECRET_ACCESS_KEY,
  });
}
