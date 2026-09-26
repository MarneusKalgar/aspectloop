import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { expect, test, vi } from 'vitest';

import type { PasswordService } from '../../src/auth/credentials/password.service';
import type { TokenService } from '../../src/auth/legacy/token.service';
import type { AuthSessionStore } from '../../src/auth/sessions/auth-session.store';
import type { User } from '../../src/users/user.entity';
import type { UsersService } from '../../src/users/users.service';

import { AuthService } from '../../src/auth/auth.service';

const ISSUED_AT = new Date('2026-09-12T00:00:00.000Z');
const EXPIRES_AT = new Date('2026-09-13T00:00:00.000Z');
const SESSION_ID = '3a1df370-e0cf-4f70-a6b9-4243bd42e825';
const USER: User = {
  createdAt: ISSUED_AT,
  displayName: 'Reviewer',
  email: 'reviewer@example.test',
  emailVerifiedAt: ISSUED_AT,
  id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
  passwordHash: 'private-hash',
  roles: ['CORRECTOR'],
  scopes: ['corrections:write'],
  updatedAt: ISSUED_AT,
};

interface ServiceFixture {
  authSessionStore: {
    create: ReturnType<typeof vi.fn>;
    createBrowserSession: ReturnType<typeof vi.fn>;
    getActiveUser: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    signOutBrowserSession: ReturnType<typeof vi.fn>;
    validateBrowserSession: ReturnType<typeof vi.fn>;
  };
  passwordService: {
    hash: ReturnType<typeof vi.fn>;
    verifyOrDummy: ReturnType<typeof vi.fn>;
  };
  service: AuthService;
  tokenService: { generateAccessToken: ReturnType<typeof vi.fn> };
  usersService: { findByEmailWithPassword: ReturnType<typeof vi.fn> };
}

/** Creates auth behavior with isolated persistence, password, and token boundaries. */
function createFixture(
  options: { passwordValid?: boolean; user?: null | User } = {},
): ServiceFixture {
  const user = options.user === undefined ? USER : options.user;
  const session = {
    effectiveExpiresAt: EXPIRES_AT,
    issuedAt: ISSUED_AT,
    refreshToken: 'refresh-token',
    sessionId: SESSION_ID,
    user: USER,
  };
  const authSessionStore = {
    create: vi.fn().mockResolvedValue(session),
    createBrowserSession: vi.fn().mockResolvedValue({
      sessionCredential: 'browser-session-credential',
      sessionExpiresAt: EXPIRES_AT,
      sessionId: SESSION_ID,
      user: USER,
    }),
    getActiveUser: vi.fn().mockResolvedValue(USER),
    refresh: vi.fn().mockResolvedValue(session),
    signOut: vi.fn().mockResolvedValue(undefined),
    signOutBrowserSession: vi.fn().mockResolvedValue(undefined),
    validateBrowserSession: vi.fn().mockResolvedValue({
      sessionExpiresAt: EXPIRES_AT,
      sessionId: SESSION_ID,
      user: USER,
    }),
  };
  const passwordService = {
    hash: vi.fn().mockResolvedValue('new-hash'),
    verifyOrDummy: vi.fn().mockResolvedValue(options.passwordValid ?? true),
  };
  const tokenService = { generateAccessToken: vi.fn().mockResolvedValue('access-token') };
  const usersService = {
    createUser: vi.fn().mockResolvedValue(USER),
    findByEmail: vi.fn().mockResolvedValue(user),
    findByEmailWithPassword: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
  };

  return {
    authSessionStore,
    passwordService,
    service: new AuthService(
      authSessionStore as unknown as AuthSessionStore,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService,
      usersService as unknown as UsersService,
    ),
    tokenService,
    usersService,
  };
}

/** Verifies prepared browser-session methods remain separate from legacy JWT issuance. */
async function testBrowserSessionDelegation(): Promise<void> {
  const fixture = createFixture();

  await expect(
    fixture.service.signInBrowserSession({ email: USER.email, password: ' password ' }),
  ).resolves.toMatchObject({
    sessionCredential: 'browser-session-credential',
    sessionExpiresAt: EXPIRES_AT.toISOString(),
    user: { id: USER.id },
  });
  await expect(
    fixture.service.validateBrowserSession({
      recordActivity: true,
      sessionCredential: 'browser-session-credential',
    }),
  ).resolves.toMatchObject({
    sessionExpiresAt: EXPIRES_AT.toISOString(),
    sessionId: SESSION_ID,
    user: { id: USER.id },
  });
  await expect(
    fixture.service.signOutBrowserSession({ sessionCredential: 'browser-session-credential' }),
  ).resolves.toEqual({ success: true });
  expect(fixture.authSessionStore.validateBrowserSession).toHaveBeenCalledWith(
    'browser-session-credential',
    true,
  );
  expect(fixture.authSessionStore.signOutBrowserSession).toHaveBeenCalledWith(
    'browser-session-credential',
  );
  expect(fixture.tokenService.generateAccessToken).not.toHaveBeenCalled();
}

/** Verifies sign-in keeps the same indistinguishable credential rejection. */
async function testInvalidCredentials(): Promise<void> {
  const fixture = createFixture({ passwordValid: false });

  await expect(
    fixture.service.signIn({ email: USER.email, password: 'wrong-password' }),
  ).rejects.toMatchObject({
    response: { code: AUTH_ERROR_CODE.INVALID_CREDENTIALS },
  });
}

/** Verifies refresh, me, and logout delegate only opaque or persisted identifiers. */
async function testSessionDelegation(): Promise<void> {
  const fixture = createFixture();

  await expect(fixture.service.refresh({ refreshToken: 'refresh-token' })).resolves.toMatchObject({
    refreshToken: 'refresh-token',
  });
  await expect(
    fixture.service.me({ sessionId: SESSION_ID, userId: USER.id }),
  ).resolves.toMatchObject({ user: { id: USER.id } });
  await expect(fixture.service.signOut({ refreshToken: 'refresh-token' })).resolves.toEqual({
    success: true,
  });
  expect(fixture.authSessionStore.signOut).toHaveBeenCalledWith('refresh-token');
}

/** Verifies successful sign-in preserves password bytes and returns the session contract. */
async function testSignIn(): Promise<void> {
  const fixture = createFixture();
  const response = await fixture.service.signIn({
    email: USER.email,
    password: ' password ',
  });

  expect(fixture.passwordService.verifyOrDummy).toHaveBeenCalledWith(
    ' password ',
    USER.passwordHash,
  );
  expect(response).toMatchObject({
    accessToken: 'access-token',
    refreshExpiresAt: EXPIRES_AT.toISOString(),
    refreshToken: 'refresh-token',
    user: { email: USER.email, id: USER.id },
  });
  expect(response.user).not.toHaveProperty('passwordHash');
}

/** Verifies supported lookup failures retain the public dependency-unavailable envelope. */
async function testSignInLookupDatabaseFailure(): Promise<void> {
  const fixture = createFixture();
  fixture.usersService.findByEmailWithPassword.mockRejectedValue(
    Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' }),
  );

  await expect(
    fixture.service.signInBrowserSession({ email: USER.email, password: ' password ' }),
  ).rejects.toMatchObject({
    response: { code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE, statusCode: 503 },
  });
  await expect(
    fixture.service.signIn({ email: USER.email, password: ' password ' }),
  ).rejects.toMatchObject({
    response: { code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE, statusCode: 503 },
  });
  expect(fixture.passwordService.verifyOrDummy).not.toHaveBeenCalled();
  expect(fixture.authSessionStore.createBrowserSession).not.toHaveBeenCalled();
  expect(fixture.authSessionStore.create).not.toHaveBeenCalled();
}

/** Verifies programming failures escape lookup classification unchanged. */
async function testSignInLookupUnexpectedFailure(): Promise<void> {
  const fixture = createFixture();
  const failure = new TypeError('unexpected lookup failure');
  fixture.usersService.findByEmailWithPassword.mockRejectedValue(failure);

  await expect(
    fixture.service.signInBrowserSession({ email: USER.email, password: ' password ' }),
  ).rejects.toBe(failure);
  expect(fixture.authSessionStore.createBrowserSession).not.toHaveBeenCalled();
}

/** Verifies unknown identities use the same dummy comparison and credential envelope. */
async function testUnknownIdentity(): Promise<void> {
  const fixture = createFixture({ user: null });

  await expect(
    fixture.service.signIn({ email: 'missing@example.test', password: 'wrong-password' }),
  ).rejects.toMatchObject({ response: { code: AUTH_ERROR_CODE.INVALID_CREDENTIALS } });
  expect(fixture.passwordService.verifyOrDummy).toHaveBeenCalledWith('wrong-password', null);
}

/** Verifies a correctly authenticated unverified identity cannot create a session. */
async function testUnverifiedIdentity(): Promise<void> {
  const fixture = createFixture({ user: { ...USER, emailVerifiedAt: null } });

  await expect(
    fixture.service.signIn({ email: USER.email, password: 'correct-password' }),
  ).rejects.toMatchObject({ response: { code: AUTH_ERROR_CODE.EMAIL_UNVERIFIED } });
  expect(fixture.authSessionStore.create).not.toHaveBeenCalled();
}

test('returns the persisted Platform sign-in session contract', testSignIn);
test('rejects invalid credentials without identity disclosure', testInvalidCredentials);
test('performs a dummy password comparison for unknown identities', testUnknownIdentity);
test('rejects unverified identities after correct credentials', testUnverifiedIdentity);
test('delegates refresh, me, and logout session operations', testSessionDelegation);
test('prepares browser-session operations without issuing a JWT', testBrowserSessionDelegation);
test(
  'maps sign-in lookup connectivity failures to dependency unavailable',
  testSignInLookupDatabaseFailure,
);
test('preserves unexpected sign-in lookup failures', testSignInLookupUnexpectedFailure);
