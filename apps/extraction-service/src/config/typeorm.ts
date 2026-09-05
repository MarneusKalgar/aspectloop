import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';

import {
  createPostgresDataSourceOptions,
  getTypeOrmDiscoveryPaths,
} from '@aspectloop/backend-platform/database';

interface TypeOrmConfig {
  databaseUrl: string;
  nodeEnv?: string;
  poolSize?: number;
  slowQueryThresholdMs?: number;
}

/** Builds the extraction datasource contract for Nest and TypeORM CLI use. */
export function getTypeOrmDataSourceOptions(config: TypeOrmConfig): DataSourceOptions {
  const paths = getTypeOrmDiscoveryPaths(config.nodeEnv);

  return createPostgresDataSourceOptions({
    databaseUrl: config.databaseUrl,
    entities: paths.entities,
    migrations: paths.migrations,
    nodeEnv: config.nodeEnv,
    poolSize: config.poolSize,
    slowQueryThresholdMs: config.slowQueryThresholdMs,
  });
}

/** Builds Nest's extraction datasource options from validated configuration. */
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
