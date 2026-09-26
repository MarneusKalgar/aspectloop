import { PLATFORM_AUTH_ROLES, PLATFORM_AUTH_SCOPES } from '@aspectloop/contracts/platform';

import type { User } from '#app/users/user.entity';

const ALLOWED_PLATFORM_AUTH_ROLES: ReadonlySet<string> = new Set(PLATFORM_AUTH_ROLES);
const ALLOWED_PLATFORM_AUTH_SCOPES: ReadonlySet<string> = new Set(PLATFORM_AUTH_SCOPES);

/** Returns whether current persisted authorization values are explicitly supported. */
export function hasAllowedPlatformAuthorization(user: User): boolean {
  return (
    hasOnlyAllowedValues(user.roles, ALLOWED_PLATFORM_AUTH_ROLES) &&
    hasOnlyAllowedValues(user.scopes, ALLOWED_PLATFORM_AUTH_SCOPES)
  );
}

/** Rejects duplicate or unexpected authorization values instead of propagating them. */
function hasOnlyAllowedValues(values: string[], allowedValues: ReadonlySet<string>): boolean {
  return (
    new Set(values).size === values.length && values.every((value) => allowedValues.has(value))
  );
}
