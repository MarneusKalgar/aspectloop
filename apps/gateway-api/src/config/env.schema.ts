import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  API_PORT: number;

  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

  @IsNumber()
  @IsOptional()
  BCRYPT_SALT_ROUNDS?: number = 10;

  @IsNumber()
  @IsOptional()
  CORRECTION_OUTBOX_FLUSH_INTERVAL_MS?: number = 5000;

  @IsString()
  CORS_ALLOWED_ORIGINS = 'http://localhost:5173';

  @IsOptional()
  @IsString()
  DATABASE_PROVIDER?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsNumber()
  @IsOptional()
  DB_POOL_SIZE?: number;

  @IsNumber()
  @IsOptional()
  DB_SLOW_QUERY_THRESHOLD_MS?: number;

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
  PERSISTENCE_REQUEST_TIMEOUT_MS?: number = 5000;

  @IsString()
  RABBITMQ_HOST!: string;

  @IsString()
  RABBITMQ_PASSWORD!: string;

  @IsNumber()
  RABBITMQ_PORT: number;

  @IsString()
  RABBITMQ_USER!: string;
}
