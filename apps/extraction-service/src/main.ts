import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const port = app.get(ConfigService).getOrThrow<number>('EXTRACTION_SERVICE_PORT');
  await app.listen(port);

  app.get(Logger).log(`extraction-service listening on http://localhost:${port}`);
}

void bootstrap();
