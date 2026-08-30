import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

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
  const { migrations } = getTypeOrmPaths(config.nodeEnv);

  return {
    entities: [User, CorrectionSession, CorrectionEdit, CorrectionEventOutbox],
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
    migrations,
    migrationsRun: false,
    synchronize: false,
    type: 'postgres',
    url: config.databaseUrl,
  };
}

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

function getTypeOrmPaths(nodeEnv?: string) {
  const isRuntimeBuild = nodeEnv === 'production' || nodeEnv === 'stage';

  if (isRuntimeBuild) {
    return {
      entities: ['dist/**/*.entity.js'],
      migrations: ['dist/db/migrations/*.js'],
    };
  }

  return {
    entities: [`src/**/*.entity{.ts,.js}`],
    migrations: ['src/db/migrations/*{.ts,.js}'],
  };
}
