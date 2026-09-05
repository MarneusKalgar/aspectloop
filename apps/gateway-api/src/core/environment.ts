import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Returns a required value from the application's validated configuration. */
export function getEnvVariable<T>(app: INestApplication, key: string): T {
  const configService = app.get(ConfigService);
  const value = configService.get<T>(key);

  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}
