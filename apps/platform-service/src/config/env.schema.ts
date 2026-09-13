import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsNotEmpty,
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
  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  BCRYPT_SALT_ROUNDS = 10;

  @IsNotEmpty()
  @IsString()
  DATABASE_URL!: string;

  @IsInt()
  @IsOptional()
  @Max(5)
  @Min(1)
  @Type(() => Number)
  DB_POOL_SIZE = 5;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  DB_SLOW_QUERY_THRESHOLD_MS = 1000;

  @IsNotEmpty()
  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL = '15m';

  @IsIn(['development', 'test', 'stage', 'production'])
  NODE_ENV = 'development';

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

  @IsInt()
  @IsOptional()
  @Max(65535)
  @Min(1)
  @Type(() => Number)
  PLATFORM_SERVICE_PORT = 8083;

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
