import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { S3ArtifactStorage } from './s3-artifact-storage';

import { ARTIFACT_STORAGE } from './artifact-storage.port';
import { createPlatformArtifactStorage } from './create-platform-artifact-storage';

@Module({
  exports: [ARTIFACT_STORAGE],
  imports: [ConfigModule],
  providers: [
    {
      inject: [ConfigService],
      provide: ARTIFACT_STORAGE,
      useFactory: createArtifactStorage,
    },
  ],
})
export class ArtifactStorageModule {}

/** Builds the gateway-owned S3 adapter from validated environment configuration. */
function createArtifactStorage(configService: ConfigService): S3ArtifactStorage {
  return createPlatformArtifactStorage({
    PLATFORM_S3_ACCESS_KEY_ID: configService.getOrThrow<string>('PLATFORM_S3_ACCESS_KEY_ID'),
    PLATFORM_S3_BUCKET: configService.getOrThrow<string>('PLATFORM_S3_BUCKET'),
    PLATFORM_S3_SECRET_ACCESS_KEY: configService.getOrThrow<string>(
      'PLATFORM_S3_SECRET_ACCESS_KEY',
    ),
    S3_ENDPOINT: configService.getOrThrow<string>('S3_ENDPOINT'),
    S3_FORCE_PATH_STYLE: configService.getOrThrow<string>('S3_FORCE_PATH_STYLE'),
    S3_REGION: configService.getOrThrow<string>('S3_REGION'),
    S3_REQUEST_TIMEOUT_MS: configService.getOrThrow<number>('S3_REQUEST_TIMEOUT_MS'),
  });
}
