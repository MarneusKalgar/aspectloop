import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { getEnvVariable } from './core/environment';
import { setGraphqlNoStore } from './core/graphql-http.middleware';
import { GATEWAY_SERVICE_NAME } from './core/service-name';
import { setupCors } from './core/setupCors';

/** Starts the Gateway with non-proxied IPs and non-cacheable GraphQL responses. */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Never let caller-controlled forwarding headers become an auth limiter identity.
  const expressApp = app.getHttpAdapter().getInstance() as {
    set(name: string, value: boolean): void;
  };
  expressApp.set('trust proxy', false);
  app.use('/graphql', setGraphqlNoStore);

  setupCors(app);

  const port = getEnvVariable<number>(app, 'API_PORT');
  await app.listen(port);

  app.get(Logger).log(`${GATEWAY_SERVICE_NAME} listening on http://localhost:${port}`);
}

void bootstrap();
