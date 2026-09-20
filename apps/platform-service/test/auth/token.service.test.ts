import { ConfigService } from '@nestjs/config';
import { expect, test, vi } from 'vitest';

import type { User } from '../../src/users/user.entity';

import { PlatformAuthException } from '../../src/auth/platform-auth.exception';
import { TokenService } from '../../src/auth/token.service';

const ISSUED_AT = new Date('2026-09-12T00:00:00.000Z');
const SESSION_ID = '3a1df370-e0cf-4f70-a6b9-4243bd42e825';
const USER: User = {
  createdAt: ISSUED_AT,
  displayName: 'Sensitive Display Name',
  email: 'sensitive@example.test',
  emailVerifiedAt: ISSUED_AT,
  id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
  passwordHash: 'private-hash',
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  updatedAt: ISSUED_AT,
};

/** Verifies access claims are bounded by persisted session time and contain no profile PII. */
async function testAccessTokenClaims(): Promise<void> {
  const signAsync = vi.fn().mockResolvedValue('access-token');
  const service = new TokenService(
    new ConfigService({
      JWT_ACCESS_AUDIENCE: 'aspectloop-gateway',
      JWT_ACCESS_ISSUER: 'aspectloop-platform',
      JWT_ACCESS_TTL: '15m',
    }),
    { signAsync } as never,
  );
  const sessionExpiry = new Date(ISSUED_AT.getTime() + 5 * 60 * 1000);

  await expect(
    service.generateAccessToken(USER, SESSION_ID, ISSUED_AT, sessionExpiry),
  ).resolves.toBe('access-token');

  const [payload, options] = signAsync.mock.calls[0] as [Record<string, unknown>, unknown];
  expect(payload).toMatchObject({
    exp: Math.floor(sessionExpiry.getTime() / 1000),
    iat: Math.floor(ISSUED_AT.getTime() / 1000),
    nbf: Math.floor(ISSUED_AT.getTime() / 1000),
    roles: USER.roles,
    scopes: USER.scopes,
    sid: SESSION_ID,
    sub: USER.id,
  });
  expect(payload).not.toHaveProperty('email');
  expect(payload).not.toHaveProperty('displayName');
  expect(options).toEqual({
    algorithm: 'HS256',
    audience: 'aspectloop-gateway',
    issuer: 'aspectloop-platform',
  });
}

/** Verifies malformed authorization arrays and exhausted persisted lifetimes fail closed. */
function testInvalidAccessClaims(): void {
  const service = new TokenService(
    new ConfigService({
      JWT_ACCESS_AUDIENCE: 'aspectloop-gateway',
      JWT_ACCESS_ISSUER: 'aspectloop-platform',
      JWT_ACCESS_TTL: '15m',
    }),
    { signAsync: vi.fn() } as never,
  );

  expect(() =>
    service.generateAccessToken(
      { ...USER, roles: Array.from({ length: 33 }, (_, index) => `ROLE_${index}`) },
      SESSION_ID,
      ISSUED_AT,
      new Date(ISSUED_AT.getTime() + 60_000),
    ),
  ).toThrow(PlatformAuthException);
  expect(() => service.generateAccessToken(USER, SESSION_ID, ISSUED_AT, ISSUED_AT)).toThrow(
    PlatformAuthException,
  );
}

test('issues PII-free access claims bounded by persisted session expiry', testAccessTokenClaims);
test('rejects malformed authorization claims and exhausted sessions', testInvalidAccessClaims);
