import type { DataSourceOptions } from 'typeorm';

import { join } from 'node:path';

export interface PostgresDataSourceConfig {
  databaseUrl: string;
  entities: NonNullable<DataSourceOptions['entities']>;
  migrations: NonNullable<DataSourceOptions['migrations']>;
  nodeEnv?: string;
  poolSize?: number;
  slowQueryThresholdMs?: number;
}

export type TypeOrmDiscoveryMode = 'compiled' | 'source';

export interface TypeOrmDiscoveryPaths {
  entities: string[];
  migrations: string[];
}

/**
 * Builds the shared bounded PostgreSQL datasource contract.
 *
 * @param config Service-owned connection, discovery, and capacity settings.
 * @returns TypeORM datasource options with explicit schema-change safeguards.
 */
export function createPostgresDataSourceOptions(
  config: PostgresDataSourceConfig,
): DataSourceOptions {
  return {
    entities: config.entities,
    extra: {
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: config.poolSize ?? 10,
    },
    invalidWhereValuesBehavior: {
      null: 'throw',
      undefined: 'throw',
    },
    logging: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
    maxQueryExecutionTime: config.slowQueryThresholdMs ?? 1000,
    migrations: config.migrations,
    migrationsRun: false,
    synchronize: false,
    type: 'postgres',
    url: config.databaseUrl,
  };
}

/**
 * Selects the repository's source or compiled TypeORM discovery convention.
 *
 * @param mode Execution form used by the current process.
 * @param applicationRoot Absolute root of the datasource-owning application.
 * @returns Explicit entity and migration globs for that runtime.
 */
export function getTypeOrmDiscoveryPaths(
  mode: TypeOrmDiscoveryMode,
  applicationRoot: string,
): TypeOrmDiscoveryPaths {
  if (mode === 'compiled') {
    return {
      entities: [join(applicationRoot, 'dist/**/*.entity.js')],
      migrations: [join(applicationRoot, 'dist/db/migrations/*.js')],
    };
  }

  return {
    entities: [join(applicationRoot, 'src/**/*.entity{.ts,.js}')],
    migrations: [join(applicationRoot, 'src/db/migrations/*{.ts,.js}')],
  };
}
