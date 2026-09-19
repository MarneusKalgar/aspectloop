import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

/** Starts the bounded internal Platform HTTP runtime. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useBodyParser('json', { limit: '64kb' });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const port = app.get(ConfigService).getOrThrow<number>('PLATFORM_SERVICE_PORT');
  await app.listen(port);

  app.get(Logger).log(`platform-service listening on http://localhost:${port}`);
}

void bootstrap();
