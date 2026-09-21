import { expect, test } from 'vitest';

import type { AuthSession } from '../../src/auth/sessions/model/auth-session.entity';
import type { User } from '../../src/users/user.entity';

import { AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS } from '../../src/auth/sessions/session.constants';
import {
  createAuthSessionExpiry,
  isAuthSessionActive,
  nextAuthSessionInactivityExpiry,
  shouldRecordAuthSessionActivity,
} from '../../src/auth/sessions/session.policy';

const NOW = new Date('2026-09-21T00:00:00.000Z');

/** Verifies revocation, expiry, and unverified identities all fail closed. */
function testActiveSessionPolicy(): void {
  const session = {
    absoluteExpiresAt: new Date(NOW.getTime() + 2_000),
    inactivityExpiresAt: new Date(NOW.getTime() + 1_000),
    revokedAt: null,
  } as AuthSession;
  const user = { emailVerifiedAt: NOW } as User;

  expect(isAuthSessionActive(session, user, NOW)).toBe(true);
  expect(isAuthSessionActive({ ...session, revokedAt: NOW }, user, NOW)).toBe(false);
  expect(isAuthSessionActive(session, { ...user, emailVerifiedAt: null }, NOW)).toBe(false);
  expect(isAuthSessionActive({ ...session, inactivityExpiresAt: NOW }, user, NOW)).toBe(false);
}

/** Verifies activity writes are allowed only at or beyond the named throttle boundary. */
function testActivityThrottle(): void {
  expect(
    shouldRecordAuthSessionActivity(
      new Date(NOW.getTime() - AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS + 1),
      NOW,
    ),
  ).toBe(false);
  expect(
    shouldRecordAuthSessionActivity(
      new Date(NOW.getTime() - AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS),
      NOW,
    ),
  ).toBe(true);
}

/** Verifies idle expiry remains capped by the absolute session lifetime. */
function testExpiryPolicy(): void {
  const expiry = createAuthSessionExpiry(NOW, 120_000, 90_000);

  expect(expiry.absoluteExpiresAt.toISOString()).toBe('2026-09-21T00:02:00.000Z');
  expect(expiry.inactivityExpiresAt.toISOString()).toBe('2026-09-21T00:01:30.000Z');
  expect(nextAuthSessionInactivityExpiry(NOW, 180_000, expiry.absoluteExpiresAt)).toEqual(
    expiry.absoluteExpiresAt,
  );
}

test('caps inactivity expiry at the absolute boundary', testExpiryPolicy);
test('throttles durable browser-session activity updates', testActivityThrottle);
test('fails closed for inactive session or identity state', testActiveSessionPolicy);
