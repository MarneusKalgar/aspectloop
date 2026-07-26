import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from './config/env.validation';
import { getPinoLoggerConfig } from './config/logger.config';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    LoggerModule.forRoot(getPinoLoggerConfig()),
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
})
export class AppModule {}
