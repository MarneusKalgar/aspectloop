import { BadRequestException } from '@nestjs/common';
import { expect, test, vi } from 'vitest';

import type { AuthService } from '../../src/auth/auth.service';

import { AuthController } from '../../src/auth/auth.controller';
/** Verifies malformed internal auth bodies fail before reaching domain behavior. */
function testInvalidSignInRequest(): void {
  const signIn = vi.fn();
  const controller = new AuthController({ signIn } as unknown as AuthService);

  expect(() => controller.signIn({ email: 'reviewer@example.test' })).toThrow(BadRequestException);
  expect(signIn).not.toHaveBeenCalled();
}

/** Verifies valid internal credentials are delegated without transport reshaping. */
async function testSignInDelegation(): Promise<void> {
  const response = {
    accessToken: 'token',
    user: {
      createdAt: '2026-09-12T00:00:00.000Z',
      displayName: 'Reviewer',
      email: 'reviewer@example.test',
      id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
      roles: ['CORRECTOR'],
      scopes: ['corrections:write'],
      updatedAt: '2026-09-12T00:00:00.000Z',
    },
  };
  const signIn = vi.fn().mockResolvedValue(response);
  const controller = new AuthController({ signIn } as unknown as AuthService);
  const request = { email: 'reviewer@example.test', password: 'password' };

  await expect(controller.signIn(request)).resolves.toEqual(response);
  expect(signIn).toHaveBeenCalledWith(request);
}

test('delegates valid internal sign-in commands', testSignInDelegation);
test('rejects malformed internal sign-in commands', testInvalidSignInRequest);
