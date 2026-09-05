import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';

import {
  createPostgresDataSourceOptions,
  getTypeOrmDiscoveryPaths,
} from '@aspectloop/backend-platform/database';

import { CorrectionSession } from '../correction-sessions/correction-session.entity';
import { CorrectionEdit, CorrectionEventOutbox } from '../corrections/correction-edit.entity';
import { User } from '../users/user.entity';

interface TypeOrmConfig {
  databaseUrl: string;
  nodeEnv?: string;
  poolSize?: number;
  slowQueryThresholdMs?: number;
}

/** Builds the shared gateway datasource contract for Nest and TypeORM CLI use. */
export function getTypeOrmDataSourceOptions(config: TypeOrmConfig): DataSourceOptions {
  const { migrations } = getTypeOrmDiscoveryPaths(config.nodeEnv);

  return createPostgresDataSourceOptions({
    databaseUrl: config.databaseUrl,
    entities: [User, CorrectionSession, CorrectionEdit, CorrectionEventOutbox],
    migrations,
    nodeEnv: config.nodeEnv,
    poolSize: config.poolSize,
    slowQueryThresholdMs: config.slowQueryThresholdMs,
  });
}

/** Builds Nest's gateway datasource options from validated configuration. */
export function getTypeOrmModuleOptions(configService: ConfigService): TypeOrmModuleOptions {
  return {
    ...getTypeOrmDataSourceOptions({
      databaseUrl: configService.getOrThrow<string>('DATABASE_URL'),
      nodeEnv: configService.get<string>('NODE_ENV'),
      poolSize: configService.get<number>('DB_POOL_SIZE'),
      slowQueryThresholdMs: configService.get<number>('DB_SLOW_QUERY_THRESHOLD_MS'),
    }),
    autoLoadEntities: true,
  };
}
