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

/** Verifies session commands validate their exact private transport shapes. */
async function testSessionCommandDelegation(): Promise<void> {
  const refresh = vi.fn().mockResolvedValue({ refreshToken: 'successor' });
  const signOut = vi.fn().mockResolvedValue({ success: true });
  const me = vi.fn().mockResolvedValue({ user: { id: 'user' } });
  const controller = new AuthController({ me, refresh, signOut } as unknown as AuthService);
  const refreshRequest = { refreshToken: 'refresh-token' };
  const meRequest = {
    sessionId: '3a1df370-e0cf-4f70-a6b9-4243bd42e825',
    userId: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
  };

  await controller.refresh(refreshRequest);
  await controller.signOut(refreshRequest);
  await controller.me(meRequest);

  expect(refresh).toHaveBeenCalledWith(refreshRequest);
  expect(signOut).toHaveBeenCalledWith(refreshRequest);
  expect(me).toHaveBeenCalledWith(meRequest);
}

/** Verifies valid internal credentials are normalized without changing password bytes. */
async function testSignInDelegation(): Promise<void> {
  const response = {
    accessToken: 'token',
    refreshExpiresAt: '2026-09-13T00:00:00.000Z',
    refreshToken: 'refresh-token',
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
  const request = { email: ' Reviewer@Example.Test ', password: ' password ' };

  await expect(controller.signIn(request)).resolves.toEqual(response);
  expect(signIn).toHaveBeenCalledWith({
    email: 'reviewer@example.test',
    password: ' password ',
  });
}

test('delegates valid internal sign-in commands', testSignInDelegation);
test('rejects malformed internal sign-in commands', testInvalidSignInRequest);
test('delegates validated private session commands', testSessionCommandDelegation);
