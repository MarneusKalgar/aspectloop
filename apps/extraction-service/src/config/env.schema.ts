import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class EnvironmentVariables {
  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

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

  @IsInt()
  @IsOptional()
  @Max(65535)
  @Min(1)
  @Type(() => Number)
  EXTRACTION_SERVICE_PORT = 8081;

  @IsIn(['development', 'test', 'stage', 'production'])
  NODE_ENV = 'development';
}
