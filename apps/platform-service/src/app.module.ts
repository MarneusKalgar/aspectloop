import { getEnvFilePaths } from '@aspectloop/backend-platform/config';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { getPinoLoggerConfig } from './config/logger.config';
import { getTypeOrmModuleOptions } from './config/typeorm';
import { DocumentRegistryModule } from './document-registry/document-registry.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthController } from './internal/health.controller';
import { PlatformHttpExceptionFilter } from './internal/platform-http-exception.filter';

/** Composes the Platform-owned runtime, persistence, and internal HTTP boundary. */
@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      envFilePath: getEnvFilePaths(),
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getPinoLoggerConfig,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getTypeOrmModuleOptions,
    }),
    AuthModule,
    DocumentRegistryModule,
    DocumentsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: PlatformHttpExceptionFilter }],
})
export class AppModule {}
