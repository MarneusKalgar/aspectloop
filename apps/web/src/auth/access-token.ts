import { decodeJwt } from 'jose/jwt/decode';
import { UnsecuredJWT } from 'jose/jwt/unsecured';
import { z } from 'zod';

const accessTokenClaimsSchema = z.object({
  displayName: z.string(),
  email: z.email(),
  exp: z.number().int().optional(),
  iat: z.number().int().optional(),
  roles: z.array(z.string()),
  scopes: z.array(z.string()),
  sub: z.string(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export interface AuthenticatedUser {
  displayName: string;
  email: string;
  id: string;
  roles: string[];
  scopes: string[];
}

export const accessTokenCookieName = 'aspectloop_access_token';

export function createUnsignedAccessToken(claims: AccessTokenClaims): string {
  return new UnsecuredJWT(claims).encode();
}

export function readAccessTokenClaims(accessToken: string): AccessTokenClaims | null {
  try {
    const result = accessTokenClaimsSchema.safeParse(decodeJwt(accessToken));

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function readUserFromAccessToken(accessToken: string): AuthenticatedUser | null {
  const claims = readAccessTokenClaims(accessToken);

  if (!claims || isExpired(claims)) {
    return null;
  }

  return {
    displayName: claims.displayName,
    email: claims.email,
    id: claims.sub,
    roles: claims.roles,
    scopes: claims.scopes,
  };
}

function isExpired(claims: AccessTokenClaims): boolean {
  return typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now();
}
