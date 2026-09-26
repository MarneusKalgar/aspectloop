import { INestApplication } from '@nestjs/common';

import { getEnvVariable } from './environment';

/** Parses the same exact browser-origin allowlist used by CORS and the request gate. */
export function getCorsOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.some((origin) => !isExactHttpOrigin(origin))) {
    throw new Error('CORS_ALLOWED_ORIGINS must contain exact HTTP(S) origins');
  }

  return [...new Set(origins)];
}

/** Installs credentialed CORS for explicitly configured browser origins. */
export function setupCors(app: INestApplication): void {
  const corsOrigins = getCorsOrigins(getEnvVariable<string>(app, 'CORS_ALLOWED_ORIGINS'));

  app.enableCors({
    credentials: true,
    maxAge: 86400,
    methods: ['GET', 'POST'],
    origin: corsOrigins,
  });
}

/** Rejects wildcard, opaque, path-bearing, and noncanonical origin entries. */
function isExactHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === value &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}
