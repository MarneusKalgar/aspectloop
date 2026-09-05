import type { DataSourceOptions } from 'typeorm';

export interface PostgresDataSourceConfig {
  databaseUrl: string;
  entities: NonNullable<DataSourceOptions['entities']>;
  migrations: NonNullable<DataSourceOptions['migrations']>;
  nodeEnv?: string;
  poolSize?: number;
  slowQueryThresholdMs?: number;
}

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
 * @param nodeEnv Validated service runtime environment.
 * @returns Explicit entity and migration globs for that runtime.
 */
export function getTypeOrmDiscoveryPaths(nodeEnv?: string): TypeOrmDiscoveryPaths {
  if (nodeEnv === 'production' || nodeEnv === 'stage') {
    return {
      entities: ['dist/**/*.entity.js'],
      migrations: ['dist/db/migrations/*.js'],
    };
  }

  return {
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: ['src/db/migrations/*{.ts,.js}'],
  };
}
