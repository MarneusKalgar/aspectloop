import { Type } from 'class-transformer';
import {
  IsBooleanString,
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
import { DatabaseEnvironmentVariables } from './database-env.schema';
import {
  AUTH_TOKEN_HMAC_SECRET_PLACEHOLDER,
  JWT_ACCESS_SECRET_PLACEHOLDER,
  JWT_CLAIM_VALUE_PATTERN,
  LOCAL_GARAGE_CREDENTIAL_PLACEHOLDER,
  MAX_AUTH_DURATION_MS,
  MAX_AUTH_SECRET_LENGTH,
  MAX_BCRYPT_SALT_ROUNDS,
  MAX_S3_CREDENTIAL_LENGTH,
  MAX_S3_REQUEST_TIMEOUT_MS,
  MIN_AUTH_DURATION_MS,
  MIN_AUTH_SECRET_LENGTH,
  MIN_BCRYPT_SALT_ROUNDS,
  S3_REGION_PATTERN,
} from './env.constants';

export class EnvironmentVariables extends DatabaseEnvironmentVariables {
  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

  @IsInt()
  @IsOptional()
  @Max(MAX_AUTH_DURATION_MS)
  @Min(MIN_AUTH_DURATION_MS)
  @Type(() => Number)
  AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS = 60_000;

  @IsInt()
  @IsOptional()
  @Max(MAX_AUTH_DURATION_MS)
  @Min(MIN_AUTH_DURATION_MS)
  @Type(() => Number)
  AUTH_EMAIL_CONFIRMATION_TTL_MS = 86_400_000;

  @IsInt()
  @IsOptional()
  @Max(MAX_AUTH_DURATION_MS)
  @Min(1)
  @Type(() => Number)
  AUTH_REFRESH_GRACE_MS = 5000;

  @IsInt()
  @IsOptional()
  @Max(MAX_AUTH_DURATION_MS)
  @Min(MIN_AUTH_DURATION_MS)
  @Type(() => Number)
  AUTH_SESSION_ABSOLUTE_TTL_MS = 604_800_000;

  @IsInt()
  @IsOptional()
  @Max(MAX_AUTH_DURATION_MS)
  @Min(MIN_AUTH_DURATION_MS)
  @Type(() => Number)
  AUTH_SESSION_IDLE_TTL_MS = 86_400_000;

  @IsString()
  @Length(MIN_AUTH_SECRET_LENGTH, MAX_AUTH_SECRET_LENGTH)
  @NotEquals(AUTH_TOKEN_HMAC_SECRET_PLACEHOLDER)
  AUTH_TOKEN_HMAC_SECRET!: string;

  @IsInt()
  @IsOptional()
  @Max(MAX_BCRYPT_SALT_ROUNDS)
  @Min(MIN_BCRYPT_SALT_ROUNDS)
  @Type(() => Number)
  BCRYPT_SALT_ROUNDS = 10;

  @IsNotEmpty()
  @IsString()
  @Matches(JWT_CLAIM_VALUE_PATTERN)
  JWT_ACCESS_AUDIENCE = 'aspectloop-gateway';

  @IsNotEmpty()
  @IsString()
  @Matches(JWT_CLAIM_VALUE_PATTERN)
  JWT_ACCESS_ISSUER = 'aspectloop-platform';

  @IsNotEmpty()
  @IsString()
  @Length(MIN_AUTH_SECRET_LENGTH, MAX_AUTH_SECRET_LENGTH)
  @NotEquals(JWT_ACCESS_SECRET_PLACEHOLDER)
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL = '15m';

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
