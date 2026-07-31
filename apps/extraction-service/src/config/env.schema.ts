import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class EnvironmentVariables {
  @IsOptional()
  @IsString()
  APP_LOG_LEVEL?: string;

  @IsNumber()
  @IsOptional()
  EXTRACTION_SERVICE_PORT = 8081;

  @IsIn(['development', 'test', 'stage', 'production'])
  NODE_ENV = 'development';
}
