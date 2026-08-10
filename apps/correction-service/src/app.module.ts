import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from './config/env.validation';
import { getPinoLoggerConfig } from './config/logger.config';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getPinoLoggerConfig,
    }),
  ],
})
export class AppModule {}
