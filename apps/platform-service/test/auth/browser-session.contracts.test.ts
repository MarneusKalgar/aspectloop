import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_HTTP_STATUS,
  AUTH_ERROR_POLICY,
  BROWSER_SESSION_AUTH_ERROR_CODES,
  browserSessionAuthErrorCodeSchema,
  PLATFORM_BROWSER_SESSION_CREDENTIAL_MAX_LENGTH,
  PLATFORM_INTERNAL_ROUTES,
  platformBrowserSessionAuthErrorResponseSchema,
  platformBrowserSessionSignInResponseSchema,
  platformBrowserSessionSignOutRequestSchema,
  platformBrowserSessionSignOutResponseSchema,
  platformBrowserSessionValidationRequestSchema,
  platformBrowserSessionValidationResponseSchema,
} from '@aspectloop/contracts/platform';
import { expect, test } from 'vitest';

const sessionCredential = 's'.repeat(PLATFORM_BROWSER_SESSION_CREDENTIAL_MAX_LENGTH);
const user = {
  createdAt: '2026-09-20T10:00:00.000Z',
  displayName: 'Reviewer',
  email: 'reviewer@example.test',
  id: '9d30c36d-5ae4-4f1b-b127-15f32de2f7cb',
  roles: ['reviewer'],
  scopes: ['correction:read'],
  updatedAt: '2026-09-20T10:00:00.000Z',
};

/** Verifies target error envelopes preserve fixed statuses and bounded retry metadata. */
function testBrowserSessionErrorEnvelopes(): void {
  const fixedErrorResponses = [
    {
      code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
      message: 'Credentials are invalid',
      statusCode: AUTH_ERROR_HTTP_STATUS.INVALID_CREDENTIALS,
    },
    {
      code: AUTH_ERROR_CODE.EMAIL_UNVERIFIED,
      message: 'Email is unverified',
      statusCode: AUTH_ERROR_HTTP_STATUS.EMAIL_UNVERIFIED,
    },
    {
      code: AUTH_ERROR_CODE.SESSION_INVALID,
      message: 'Session is invalid',
      statusCode: AUTH_ERROR_HTTP_STATUS.SESSION_INVALID,
    },
    {
      code: AUTH_ERROR_CODE.CONFIRMATION_INVALID,
      message: 'Confirmation is invalid',
      statusCode: AUTH_ERROR_HTTP_STATUS.CONFIRMATION_INVALID,
    },
    {
      code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
      message: 'Authentication dependency is unavailable',
      statusCode: AUTH_ERROR_HTTP_STATUS.DEPENDENCY_UNAVAILABLE,
    },
  ];

  for (const errorResponse of fixedErrorResponses) {
    expect(platformBrowserSessionAuthErrorResponseSchema.parse(errorResponse)).toEqual(
      errorResponse,
    );
  }

  expect(
    platformBrowserSessionAuthErrorResponseSchema.parse({
      code: AUTH_ERROR_CODE.RATE_LIMITED,
      message: 'Try again later',
      retryAfterMs: AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX,
      statusCode: AUTH_ERROR_HTTP_STATUS.RATE_LIMITED,
    }),
  ).toEqual({
    code: AUTH_ERROR_CODE.RATE_LIMITED,
    message: 'Try again later',
    retryAfterMs: AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX,
    statusCode: AUTH_ERROR_HTTP_STATUS.RATE_LIMITED,
  });
  expect(
    platformBrowserSessionAuthErrorResponseSchema.safeParse({
      code: AUTH_ERROR_CODE.RATE_LIMITED,
      message: 'Try again later',
      retryAfterMs: AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX + 1,
      statusCode: AUTH_ERROR_HTTP_STATUS.RATE_LIMITED,
    }).success,
  ).toBe(false);
  expect(
    platformBrowserSessionAuthErrorResponseSchema.safeParse({
      code: AUTH_ERROR_CODE.SESSION_INVALID,
      message: 'Session is invalid',
      retryAfterMs: 1,
      statusCode: AUTH_ERROR_HTTP_STATUS.SESSION_INVALID,
    }).success,
  ).toBe(false);
}

/** Verifies the target vocabulary excludes JWT and refresh-rotation errors. */
function testBrowserSessionErrorVocabulary(): void {
  expect(BROWSER_SESSION_AUTH_ERROR_CODES).toEqual([
    AUTH_ERROR_CODE.INVALID_CREDENTIALS,
    AUTH_ERROR_CODE.EMAIL_UNVERIFIED,
    AUTH_ERROR_CODE.SESSION_INVALID,
    AUTH_ERROR_CODE.CONFIRMATION_INVALID,
    AUTH_ERROR_CODE.RATE_LIMITED,
    AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
  ]);
  expect(browserSessionAuthErrorCodeSchema.safeParse(AUTH_ERROR_CODE.ACCESS_INVALID).success).toBe(
    false,
  );
  expect(
    browserSessionAuthErrorCodeSchema.safeParse(AUTH_ERROR_CODE.REFRESH_CONFLICT).success,
  ).toBe(false);
}

/** Verifies commands require bounded credentials and server-owned activity intent. */
function testPrivateSessionCommandBounds(): void {
  expect(
    platformBrowserSessionValidationRequestSchema.parse({
      recordActivity: false,
      sessionCredential,
    }),
  ).toEqual({ recordActivity: false, sessionCredential });
  expect(
    platformBrowserSessionValidationRequestSchema.safeParse({
      sessionCredential,
    }).success,
  ).toBe(false);
  expect(
    platformBrowserSessionValidationRequestSchema.safeParse({
      recordActivity: true,
      sessionCredential: `${sessionCredential}x`,
    }).success,
  ).toBe(false);
  expect(
    platformBrowserSessionValidationRequestSchema.safeParse({
      recordActivity: true,
      sessionCredential: '',
    }).success,
  ).toBe(false);
  expect(
    platformBrowserSessionSignOutRequestSchema.safeParse({
      refreshToken: sessionCredential,
      sessionCredential,
    }).success,
  ).toBe(false);
  expect(platformBrowserSessionSignOutResponseSchema.parse({ success: true })).toEqual({
    success: true,
  });
  expect(platformBrowserSessionSignOutResponseSchema.safeParse({ success: false }).success).toBe(
    false,
  );
}

/** Verifies private issuance exposes the credential only in its intended response. */
function testPrivateSessionCredentialBoundary(): void {
  expect(
    platformBrowserSessionSignInResponseSchema.parse({
      sessionCredential,
      sessionExpiresAt: '2026-09-27T10:00:00.000Z',
      user,
    }),
  ).toEqual({
    sessionCredential,
    sessionExpiresAt: '2026-09-27T10:00:00.000Z',
    user,
  });

  expect(
    platformBrowserSessionValidationResponseSchema.safeParse({
      sessionCredential,
      sessionExpiresAt: '2026-09-27T10:00:00.000Z',
      sessionId: '3a1df370-e0cf-4f70-a6b9-4243bd42e825',
      user,
    }).success,
  ).toBe(false);
  expect(
    platformBrowserSessionSignInResponseSchema.safeParse({
      accessToken: 'legacy-access-token',
      refreshExpiresAt: '2026-09-27T10:00:00.000Z',
      refreshToken: sessionCredential,
      user,
    }).success,
  ).toBe(false);
}

/** Verifies validation returns a strict secret-free authoritative identity. */
function testPrivateSessionValidationResponse(): void {
  expect(
    platformBrowserSessionValidationResponseSchema.parse({
      sessionExpiresAt: '2026-09-27T10:00:00.000+00:00',
      sessionId: '3a1df370-e0cf-4f70-a6b9-4243bd42e825',
      user,
    }),
  ).toEqual({
    sessionExpiresAt: '2026-09-27T10:00:00.000+00:00',
    sessionId: '3a1df370-e0cf-4f70-a6b9-4243bd42e825',
    user,
  });
  expect(
    platformBrowserSessionValidationResponseSchema.safeParse({
      sessionExpiresAt: 'seven days',
      sessionId: '3a1df370-e0cf-4f70-a6b9-4243bd42e825',
      user,
    }).success,
  ).toBe(false);
}

/** Verifies the additive route constant does not alter existing auth paths. */
function testSessionValidationRoute(): void {
  expect(PLATFORM_INTERNAL_ROUTES.auth.validateSession).toBe('/internal/v1/auth/session/validate');
  expect(PLATFORM_INTERNAL_ROUTES.auth.refreshSession).toBe('/internal/v1/auth/refresh');
}

test(
  'keeps the opaque credential within the intended private issuance boundary',
  testPrivateSessionCredentialBoundary,
);
test(
  'enforces bounded session commands and explicit activity intent',
  testPrivateSessionCommandBounds,
);
test('returns strict secret-free session validation results', testPrivateSessionValidationResponse);
test('defines the six-code browser-session auth vocabulary', testBrowserSessionErrorVocabulary);
test('enforces target auth error statuses and retry bounds', testBrowserSessionErrorEnvelopes);
test('adds session validation without replacing active auth routes', testSessionValidationRoute);
