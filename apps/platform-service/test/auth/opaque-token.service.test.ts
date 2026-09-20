import { ConfigService } from '@nestjs/config';
import { expect, test } from 'vitest';

import { OPAQUE_TOKEN_PURPOSE, OpaqueTokenService } from '../../src/auth/opaque-token.service';

const HMAC_SECRET = 'test-only-hmac-secret-at-least-32-bytes';

/** Verifies malformed, altered, and cross-purpose candidates fail authentication. */
function testOpaqueTokenRejection(): void {
  const service = new OpaqueTokenService(
    new ConfigService({ AUTH_TOKEN_HMAC_SECRET: HMAC_SECRET }),
  );
  const issued = service.issue(OPAQUE_TOKEN_PURPOSE.REFRESH);
  const separatorIndex = issued.rawToken.indexOf('.');
  const secret = issued.rawToken.slice(separatorIndex + 1);
  const altered = `${issued.rawToken.slice(0, separatorIndex + 1)}${
    secret.startsWith('A') ? 'B' : 'A'
  }${secret.slice(1)}`;
  const alteredParsed = service.parse(altered, OPAQUE_TOKEN_PURPOSE.REFRESH);
  const wrongPurpose = service.parse(issued.rawToken, OPAQUE_TOKEN_PURPOSE.EMAIL_VERIFICATION);

  expect(service.parse('not-a-token', OPAQUE_TOKEN_PURPOSE.REFRESH)).toBeNull();
  expect(alteredParsed).not.toBeNull();
  expect(service.matches(alteredParsed?.digest ?? '', issued.digest)).toBe(false);
  expect(service.matches(wrongPurpose?.digest ?? '', issued.digest)).toBe(false);
}

/** Verifies issued opaque values authenticate while raw secrets never equal persisted digests. */
function testOpaqueTokenRoundTrip(): void {
  const service = new OpaqueTokenService(
    new ConfigService({ AUTH_TOKEN_HMAC_SECRET: HMAC_SECRET }),
  );
  const issued = service.issue(OPAQUE_TOKEN_PURPOSE.REFRESH);
  const parsed = service.parse(issued.rawToken, OPAQUE_TOKEN_PURPOSE.REFRESH);

  expect(parsed).toEqual({ digest: issued.digest, id: issued.id });
  expect(issued.digest).not.toContain(issued.rawToken);
  expect(service.matches(parsed?.digest ?? '', issued.digest)).toBe(true);
}

test('issues canonical opaque tokens backed by HMAC digests', testOpaqueTokenRoundTrip);
test('rejects malformed, altered, and cross-purpose opaque tokens', testOpaqueTokenRejection);
