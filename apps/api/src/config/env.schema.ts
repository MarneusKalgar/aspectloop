import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  API_PORT = 8080;

  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

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

  @IsIn(['development', 'test', 'stage', 'production'])
  NODE_ENV = 'development';

  @IsString()
  RABBITMQ_HOST!: string;

  @IsNumber()
  RABBITMQ_PORT = 5672;
}
