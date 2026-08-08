import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { getPinoLoggerConfig } from './config/logger.config';
import { getTypeOrmModuleOptions } from './config/typeorm';
import { getEnvFilePaths } from './core/environment';
import { CorrectionSessionsModule } from './correction-sessions/correction-sessions.module';
import { CorrectionsModule } from './corrections/corrections.module';
import { DocumentRegistryModule } from './document-registry/document-registry.module';
import { GraphqlApiModule } from './graphql/graphql.module';
import { HealthController } from './health/health.controller';
import { PersistenceModule } from './persistence/persistence.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { UsersModule } from './users/users.module';

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
    GraphqlApiModule,
    UsersModule,
    AuthModule,
    DocumentRegistryModule,
    PersistenceModule,
    CorrectionSessionsModule,
    CorrectionsModule,
    RabbitmqModule,
  ],
})
export class AppModule {}
