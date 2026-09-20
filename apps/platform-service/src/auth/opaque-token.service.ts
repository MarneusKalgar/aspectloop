import {
  PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH,
  PLATFORM_REFRESH_TOKEN_MAX_LENGTH,
} from '@aspectloop/contracts/platform';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import { AUTH_DIGEST_HEX_LENGTH, AUTH_OPAQUE_SECRET_BYTES } from './auth.constants';

const OPAQUE_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export const OPAQUE_TOKEN_PURPOSE = Object.freeze({
  EMAIL_VERIFICATION: 'email-verification',
  REFRESH: 'refresh',
} as const);

export interface IssuedOpaqueToken {
  digest: string;
  id: string;
  rawToken: string;
}

export type OpaqueTokenPurpose = (typeof OPAQUE_TOKEN_PURPOSE)[keyof typeof OPAQUE_TOKEN_PURPOSE];

export interface ParsedOpaqueToken {
  digest: string;
  id: string;
}

@Injectable()
export class OpaqueTokenService {
  private readonly hmacKey: Buffer;

  /** Creates the opaque-token authority from the Platform-only HMAC secret. */
  constructor(configService: ConfigService) {
    this.hmacKey = Buffer.from(configService.getOrThrow<string>('AUTH_TOKEN_HMAC_SECRET'), 'utf8');
  }

  /**
   * Issues a canonical opaque token while returning only its digest for persistence.
   *
   * @param purpose Domain-separation label for the token family.
   * @returns Raw one-time delivery value plus its safe persistence identity.
   */
  issue(purpose: OpaqueTokenPurpose): IssuedOpaqueToken {
    const id = randomUUID();
    const secret = randomBytes(AUTH_OPAQUE_SECRET_BYTES);
    const encodedSecret = secret.toString('base64url');

    return {
      digest: this.computeDigest(purpose, id, secret),
      id,
      rawToken: `${id}.${encodedSecret}`,
    };
  }

  /**
   * Compares two fixed-length HMAC digests without early-exit byte comparison.
   *
   * @param candidate Digest derived from the supplied opaque secret.
   * @param stored Persisted expected digest.
   * @returns Whether both canonical digests are equal.
   */
  matches(candidate: string, stored: string): boolean {
    if (
      candidate.length !== AUTH_DIGEST_HEX_LENGTH ||
      stored.length !== AUTH_DIGEST_HEX_LENGTH ||
      !DIGEST_PATTERN.test(candidate) ||
      !DIGEST_PATTERN.test(stored)
    ) {
      return false;
    }

    return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(stored, 'hex'));
  }

  /**
   * Parses and authenticates a canonical token candidate into its lookup identity and digest.
   *
   * @param rawToken Untrusted opaque token received from the private Gateway boundary.
   * @param purpose Expected domain-separation label.
   * @returns Token identity and candidate digest, or null for malformed input.
   */
  parse(rawToken: string, purpose: OpaqueTokenPurpose): null | ParsedOpaqueToken {
    const maximumLength =
      purpose === OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION
        ? PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH
        : PLATFORM_REFRESH_TOKEN_MAX_LENGTH;

    if (rawToken.length > maximumLength || !OPAQUE_TOKEN_PATTERN.test(rawToken)) {
      return null;
    }

    const separatorIndex = rawToken.indexOf('.');
    const id = rawToken.slice(0, separatorIndex);
    const encodedSecret = rawToken.slice(separatorIndex + 1);
    const secret = Buffer.from(encodedSecret, 'base64url');

    if (
      secret.length !== AUTH_OPAQUE_SECRET_BYTES ||
      secret.toString('base64url') !== encodedSecret
    ) {
      return null;
    }

    return { digest: this.computeDigest(purpose, id, secret), id };
  }

  /** Builds a purpose- and identifier-bound HMAC for safe persistence. */
  private computeDigest(purpose: OpaqueTokenPurpose, id: string, secret: Buffer): string {
    return createHmac('sha256', this.hmacKey)
      .update(purpose, 'utf8')
      .update('\0', 'utf8')
      .update(id, 'utf8')
      .update('\0', 'utf8')
      .update(secret)
      .digest('hex');
  }
}
