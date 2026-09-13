import { IsNodeEnvironment, type NodeEnvironment } from '@aspectloop/backend-platform/config';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/** Environment required by Platform TypeORM CLI operations. */
export class DatabaseEnvironmentVariables {
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

  @IsNodeEnvironment()
  NODE_ENV: NodeEnvironment = 'development';
}
