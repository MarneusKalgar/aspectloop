import { BadRequestException } from '@nestjs/common';
import { expect, test, vi } from 'vitest';

import type { AuthService } from '../../src/auth/auth.service';

import { AuthController } from '../../src/auth/auth.controller';
/** Verifies malformed internal auth bodies fail before reaching domain behavior. */
function testInvalidSignInRequest(): void {
  const signInBrowserSession = vi.fn();
  const controller = new AuthController({ signInBrowserSession } as unknown as AuthService);

  expect(() => controller.signIn({ email: 'reviewer@example.test' })).toThrow(BadRequestException);
  expect(signInBrowserSession).not.toHaveBeenCalled();
}

/** Verifies active browser-session commands validate their exact private shapes. */
async function testSessionCommandDelegation(): Promise<void> {
  const signOutBrowserSession = vi.fn().mockResolvedValue({ success: true });
  const validateBrowserSession = vi.fn().mockResolvedValue({ user: { id: 'user' } });
  const controller = new AuthController({
    signOutBrowserSession,
    validateBrowserSession,
  } as unknown as AuthService);
  const sessionCredential = `88d58420-dcdb-4d35-a80c-fad8f3d81119.${'a'.repeat(43)}`;
  const signOutRequest = { sessionCredential };
  const validationRequest = {
    recordActivity: false,
    sessionCredential,
  };

  await controller.signOut(signOutRequest);
  await controller.validateSession(validationRequest);

  expect(signOutBrowserSession).toHaveBeenCalledWith(signOutRequest);
  expect(validateBrowserSession).toHaveBeenCalledWith(validationRequest);
}

/** Verifies valid internal credentials are normalized without changing password bytes. */
async function testSignInDelegation(): Promise<void> {
  const response = {
    sessionCredential: 'session-secret',
    sessionExpiresAt: '2026-09-13T00:00:00.000Z',
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
  const signInBrowserSession = vi.fn().mockResolvedValue(response);
  const controller = new AuthController({ signInBrowserSession } as unknown as AuthService);
  const request = { email: ' Reviewer@Example.Test ', password: ' password ' };

  await expect(controller.signIn(request)).resolves.toEqual(response);
  expect(signInBrowserSession).toHaveBeenCalledWith({
    email: 'reviewer@example.test',
    password: ' password ',
  });
}

test('delegates valid internal sign-in commands', testSignInDelegation);
test('rejects malformed internal sign-in commands', testInvalidSignInRequest);
test('delegates validated private session commands', testSessionCommandDelegation);
