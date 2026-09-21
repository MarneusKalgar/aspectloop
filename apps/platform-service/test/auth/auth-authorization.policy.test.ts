import { PLATFORM_AUTH_ROLE, PLATFORM_AUTH_SCOPE } from '@aspectloop/contracts/platform';
import { expect, test } from 'vitest';

import type { User } from '../../src/users/user.entity';

import { hasAllowedPlatformAuthorization } from '../../src/auth/authorization/authorization.policy';

/** Verifies persisted roles and scopes are restricted to explicit Platform values. */
function testAuthorizationAllowlist(): void {
  const user = {
    roles: [PLATFORM_AUTH_ROLE.CORRECTOR],
    scopes: [PLATFORM_AUTH_SCOPE.CORRECTIONS_WRITE],
  } as User;

  expect(hasAllowedPlatformAuthorization(user)).toBe(true);
  expect(hasAllowedPlatformAuthorization({ ...user, roles: ['ADMIN'] })).toBe(false);
  expect(hasAllowedPlatformAuthorization({ ...user, scopes: ['corrections:delete'] })).toBe(false);
  expect(
    hasAllowedPlatformAuthorization({
      ...user,
      roles: [PLATFORM_AUTH_ROLE.CORRECTOR, PLATFORM_AUTH_ROLE.CORRECTOR],
    }),
  ).toBe(false);
}

test('fails closed for unexpected or duplicate authorization values', testAuthorizationAllowlist);
