import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  NotEquals,
} from 'class-validator';

import { S3_BUCKET_NAME_PATTERN } from '../storage/artifact-storage.constants';
import {
  LOCAL_GARAGE_CREDENTIAL_PLACEHOLDER,
  MAX_S3_CREDENTIAL_LENGTH,
  MAX_S3_REQUEST_TIMEOUT_MS,
  S3_REGION_PATTERN,
} from './env.constants';

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
  BCRYPT_SALT_ROUNDS?: number = 10;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  CORRECTION_OUTBOX_FLUSH_INTERVAL_MS?: number = 5000;

  @IsString()
  CORS_ALLOWED_ORIGINS = 'http://localhost:5173';

  @IsOptional()
  @IsString()
  DATABASE_PROVIDER?: string;

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

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL?: string = '15m';

  @IsIn(['development', 'test', 'stage', 'production'])
  NODE_ENV = 'development';

  @IsString()
  PERSISTENCE_BASE_URL!: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  PERSISTENCE_REQUEST_TIMEOUT_MS?: number = 5000;

  @IsString()
  @Length(1, 128)
  @NotEquals(LOCAL_GARAGE_CREDENTIAL_PLACEHOLDER)
  PLATFORM_S3_ACCESS_KEY_ID!: string;

  @IsString()
  @Matches(S3_BUCKET_NAME_PATTERN)
  PLATFORM_S3_BUCKET!: string;

  @IsString()
  @Length(1, MAX_S3_CREDENTIAL_LENGTH)
  @NotEquals(LOCAL_GARAGE_CREDENTIAL_PLACEHOLDER)
  PLATFORM_S3_SECRET_ACCESS_KEY!: string;

  @IsString()
  RABBITMQ_HOST!: string;

  @IsString()
  RABBITMQ_PASSWORD!: string;

  @IsNumber()
  @Type(() => Number)
  RABBITMQ_PORT: number;

  @IsString()
  RABBITMQ_USER!: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  S3_ENDPOINT!: string;

  @IsBooleanString()
  S3_FORCE_PATH_STYLE = 'true';

  @IsString()
  @Matches(S3_REGION_PATTERN)
  S3_REGION!: string;

  @IsInt()
  @Max(MAX_S3_REQUEST_TIMEOUT_MS)
  @Min(1)
  @Type(() => Number)
  S3_REQUEST_TIMEOUT_MS = 5000;
}
