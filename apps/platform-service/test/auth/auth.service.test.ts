import { UnauthorizedException } from '@nestjs/common';
import { expect, test, vi } from 'vitest';

import type { PasswordService } from '../../src/auth/password.service';
import type { TokenService } from '../../src/auth/token.service';
import type { User } from '../../src/users/user.entity';
import type { UsersService } from '../../src/users/users.service';

import { AuthService } from '../../src/auth/auth.service';

const USER: User = {
  createdAt: new Date('2026-09-12T00:00:00.000Z'),
  displayName: 'Reviewer',
  email: 'reviewer@example.test',
  id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
  passwordHash: 'private-hash',
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  updatedAt: new Date('2026-09-12T00:00:00.000Z'),
};

/** Creates auth behavior with isolated user, password, and token boundaries. */
function createService(
  options: {
    passwordValid?: boolean;
    user?: null | User;
  } = {},
): AuthService {
  const user = options.user === undefined ? USER : options.user;

  return new AuthService(
    {
      hash: vi.fn().mockResolvedValue('new-hash'),
      verify: vi.fn().mockResolvedValue(options.passwordValid ?? true),
    } as unknown as PasswordService,
    { generateAccessToken: vi.fn().mockResolvedValue('access-token') } as unknown as TokenService,
    {
      createUser: vi.fn().mockResolvedValue(USER),
      findByEmail: vi.fn().mockResolvedValue(user),
      findByEmailWithPassword: vi.fn().mockResolvedValue(user),
      findById: vi.fn().mockResolvedValue(user),
    } as unknown as UsersService,
  );
}

/** Verifies sign-in keeps the same indistinguishable credential rejection. */
async function testInvalidCredentials(): Promise<void> {
  await expect(
    createService({ passwordValid: false }).signIn({
      email: USER.email,
      password: 'wrong-password',
    }),
  ).rejects.toBeInstanceOf(UnauthorizedException);
}

/** Verifies successful sign-in returns the stable password-free contract. */
async function testSignIn(): Promise<void> {
  const response = await createService().signIn({
    email: ' Reviewer@Example.Test ',
    password: ' password ',
  });

  expect(response).toMatchObject({
    accessToken: 'access-token',
    user: { email: USER.email, id: USER.id },
  });
  expect(response.user).not.toHaveProperty('passwordHash');
}

test('returns the stable Platform sign-in contract', testSignIn);
test('rejects invalid credentials without identity disclosure', testInvalidCredentials);
