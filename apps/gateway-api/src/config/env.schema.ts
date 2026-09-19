import { IsNodeEnvironment, type NodeEnvironment } from '@aspectloop/backend-platform/config';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

import { MAX_PLATFORM_REQUEST_TIMEOUT_MS } from '../platform/platform.constants';

export class EnvironmentVariables {
  @IsNumber()
  @Type(() => Number)
  API_PORT: number;

  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  CORRECTION_OUTBOX_FLUSH_INTERVAL_MS?: number = 5000;

  @IsString()
  CORS_ALLOWED_ORIGINS = 'http://localhost:5173';

  @IsNotEmpty()
  @IsString()
  DATABASE_URL!: string;

  @IsInt()
  @IsOptional()
  @Max(10)
  @Min(1)
  @Type(() => Number)
  DB_POOL_SIZE = 10;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  DB_SLOW_QUERY_THRESHOLD_MS = 1000;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsNodeEnvironment()
  NODE_ENV: NodeEnvironment = 'development';

  @IsString()
  PERSISTENCE_BASE_URL!: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  PERSISTENCE_REQUEST_TIMEOUT_MS?: number = 5000;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  PLATFORM_BASE_URL!: string;

  @IsInt()
  @IsOptional()
  @Max(MAX_PLATFORM_REQUEST_TIMEOUT_MS)
  @Min(1)
  @Type(() => Number)
  PLATFORM_REQUEST_TIMEOUT_MS = 5000;

  @IsString()
  RABBITMQ_HOST!: string;

  @IsString()
  RABBITMQ_PASSWORD!: string;

  @IsNumber()
  @Type(() => Number)
  RABBITMQ_PORT: number;

  @IsString()
  RABBITMQ_USER!: string;
}
