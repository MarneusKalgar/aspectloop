import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { getEnvVariable } from './core/environment';
import { setupCors } from './core/setupCors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  setupCors(app);

  const port = getEnvVariable<number>(app, 'API_PORT');
  await app.listen(port);

  app.get(Logger).log(`gateway-api listening on http://localhost:${port}`);
}

void bootstrap();
