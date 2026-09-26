import type { INestApplication } from '@nestjs/common';

import { getCorsOrigins, setupCors } from '@gateway/core/setupCors';
import { expect, test, vi } from 'vitest';

/** Pins exact CORS/CSRF origins rather than allowing wildcards or URL paths. */
function testCorsOriginParsing(): void {
  expect(getCorsOrigins('http://localhost:5173,https://app.example.test')).toEqual([
    'http://localhost:5173',
    'https://app.example.test',
  ]);
  expect(() => getCorsOrigins('*')).toThrow();
  expect(() => getCorsOrigins('null')).toThrow();
  expect(() => getCorsOrigins('https://app.example.test/path')).toThrow();
  expect(() => getCorsOrigins('')).toThrow();
}

test('accepts only exact HTTP(S) CORS origins', testCorsOriginParsing);

/** Pins credentialed CORS to the exact shared allowlist. */
function testCorsSetup(): void {
  const enableCors = vi.fn();
  const app = {
    enableCors,
    get: () => ({ get: () => 'http://localhost:5173,http://localhost:8080' }),
  } as unknown as INestApplication;

  setupCors(app);

  expect(enableCors).toHaveBeenCalledWith({
    credentials: true,
    maxAge: 86400,
    methods: ['GET', 'POST'],
    origin: ['http://localhost:5173', 'http://localhost:8080'],
  });
}

test('configures credentialed CORS with exact browser origins', testCorsSetup);
