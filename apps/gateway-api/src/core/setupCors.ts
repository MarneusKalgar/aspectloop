import { INestApplication } from '@nestjs/common';

import { getEnvVariable } from './environment';

export function setupCors(app: INestApplication): void {
  const corsOrigins = getEnvVariable<string>(app, 'CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    credentials: true,
    maxAge: 86400,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    origin: corsOrigins,
  });
}
