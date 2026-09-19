import type { PlatformUserView } from '@aspectloop/contracts/platform';

import { platformUserViewSchema } from '@aspectloop/contracts/platform';

import type { User } from './user.entity';

/** Maps persistence state to the password-free internal user contract. */
export function toPlatformUserView(user: User): PlatformUserView {
  return platformUserViewSchema.parse({
    createdAt: user.createdAt.toISOString(),
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    roles: user.roles,
    scopes: user.scopes,
    updatedAt: user.updatedAt.toISOString(),
  });
}
