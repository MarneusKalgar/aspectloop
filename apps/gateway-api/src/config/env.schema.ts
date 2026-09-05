import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

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
  RABBITMQ_HOST!: string;

  @IsString()
  RABBITMQ_PASSWORD!: string;

  @IsNumber()
  @Type(() => Number)
  RABBITMQ_PORT: number;

  @IsString()
  RABBITMQ_USER!: string;
}
