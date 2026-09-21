import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { parseAccessTokenTtlMs } from '../../config/auth-duration';
import { User } from '../../users/user.entity';
import { PlatformAuthException } from '../platform-auth.exception';
import {
  AUTH_JWT_AUTHORIZATION_VALUE_MAX_LENGTH,
  AUTH_JWT_AUTHORIZATION_VALUE_PATTERN,
  AUTH_JWT_AUTHORIZATION_VALUES_MAX,
} from './token.constants';

interface JwtPayload {
  exp: number;
  iat: number;
  nbf: number;
  roles: string[];
  scopes: string[];
  sid: string;
  sub: string;
}

@Injectable()
export class TokenService {
  private readonly accessTokenTtlMs: number;
  private readonly audience: string;
  private readonly issuer: string;
  private readonly logger = new Logger(TokenService.name);

  /** Creates the access-token issuer from already validated Platform configuration. */
  constructor(
    configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    const accessTokenTtlMs = parseAccessTokenTtlMs(
      configService.getOrThrow<string>('JWT_ACCESS_TTL'),
    );

    if (accessTokenTtlMs === null) {
      throw new Error('JWT_ACCESS_TTL was not validated before TokenService construction');
    }

    this.accessTokenTtlMs = accessTokenTtlMs;
    this.audience = configService.getOrThrow<string>('JWT_ACCESS_AUDIENCE');
    this.issuer = configService.getOrThrow<string>('JWT_ACCESS_ISSUER');
  }

  /**
   * Generates an access token while logging only the internal subject identifier.
   *
   * @param user Authoritative authenticated user represented by the token.
   * @param sessionId Persisted session-family identifier bound to the token.
   * @param issuedAt Database time used as the claim clock.
   * @param sessionExpiresAt Earliest persisted session expiry boundary.
   * @returns A signed access token.
   */
  generateAccessToken(
    user: User,
    sessionId: string,
    issuedAt: Date,
    sessionExpiresAt: Date,
  ): Promise<string> {
    const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
    const expiresAtSeconds = Math.min(
      Math.floor((issuedAt.getTime() + this.accessTokenTtlMs) / 1000),
      Math.floor(sessionExpiresAt.getTime() / 1000),
    );

    if (expiresAtSeconds <= issuedAtSeconds) {
      throw new PlatformAuthException(
        AUTH_ERROR_CODE.SESSION_INVALID,
        'Authentication session is invalid',
      );
    }

    const payload: JwtPayload = {
      exp: expiresAtSeconds,
      iat: issuedAtSeconds,
      nbf: issuedAtSeconds,
      roles: validateAuthorizationValues(user.roles),
      scopes: validateAuthorizationValues(user.scopes),
      sid: sessionId,
      sub: user.id,
    };

    this.logger.debug({
      event: 'auth.access_token.generating',
      userId: user.id,
    });

    return this.jwtService.signAsync(payload, {
      algorithm: 'HS256',
      audience: this.audience,
      issuer: this.issuer,
    });
  }
}

/** Copies only bounded authorization values into signed access-token claims. */
function validateAuthorizationValues(values: string[]): string[] {
  if (
    values.length > AUTH_JWT_AUTHORIZATION_VALUES_MAX ||
    new Set(values).size !== values.length ||
    values.some(
      (value) =>
        value.length === 0 ||
        value.length > AUTH_JWT_AUTHORIZATION_VALUE_MAX_LENGTH ||
        !AUTH_JWT_AUTHORIZATION_VALUE_PATTERN.test(value),
    )
  ) {
    throw new PlatformAuthException(
      AUTH_ERROR_CODE.SESSION_INVALID,
      'Authentication session is invalid',
    );
  }

  return [...values];
}
