import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { config as loadDotEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function getEnvFilePaths(cwd: string = process.cwd()): string[] {
  const candidates = [resolve(cwd, '.env.local'), resolve(cwd, '.env')];

  return candidates.filter((filePath, index) => candidates.indexOf(filePath) === index);
}

export function getEnvVariable<T>(app: INestApplication, key: string): T {
  const configService = app.get(ConfigService);
  const value = configService.get<T>(key);

  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export function loadEnvFiles(cwd: string = process.cwd()): void {
  for (const filePath of getEnvFilePaths(cwd)) {
    if (existsSync(filePath)) {
      loadDotEnv({ override: false, path: filePath });
    }
  }
}
