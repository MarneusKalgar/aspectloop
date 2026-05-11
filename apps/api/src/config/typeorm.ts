import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

interface TypeOrmConfig {
  databaseUrl: string;
  nodeEnv?: string;
  poolSize?: number;
  slowQueryThresholdMs?: number;
}

export function getTypeOrmDataSourceOptions(config: TypeOrmConfig): DataSourceOptions {
  const { migrations } = getTypeOrmPaths(config.nodeEnv);

  return {
    extra: {
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: config.poolSize ?? 10,
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
      migrations: ['dist/db/migrations/*.js'],
    };
  }

  return {
    migrations: ['src/db/migrations/*{.ts,.js}'],
  };
}
