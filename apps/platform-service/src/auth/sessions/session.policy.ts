import type { User } from '../../users/user.entity';
import type { AuthSession } from './model/auth-session.entity';

import { AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS } from './session.constants';

export interface AuthSessionExpiry {
  absoluteExpiresAt: Date;
  inactivityExpiresAt: Date;
}

/** Adds a validated duration without leaking application-host time into decisions. */
export function addMilliseconds(value: Date, durationMs: number): Date {
  return new Date(value.getTime() + durationMs);
}

/** Builds bounded absolute and idle expiry values from an authoritative clock. */
export function createAuthSessionExpiry(
  now: Date,
  absoluteTtlMs: number,
  idleTtlMs: number,
): AuthSessionExpiry {
  const absoluteExpiresAt = addMilliseconds(now, absoluteTtlMs);

  return {
    absoluteExpiresAt,
    inactivityExpiresAt: minDate(addMilliseconds(now, idleTtlMs), absoluteExpiresAt),
  };
}

/** Returns whether persisted session and user state may authorize a request. */
export function isAuthSessionActive(session: AuthSession, user: User, now: Date): boolean {
  return (
    user.emailVerifiedAt !== null &&
    session.revokedAt === null &&
    session.absoluteExpiresAt.getTime() > now.getTime() &&
    session.inactivityExpiresAt.getTime() > now.getTime()
  );
}

/** Returns the earlier of two expiry boundaries. */
export function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

/** Computes the next idle boundary without exceeding the absolute session lifetime. */
export function nextAuthSessionInactivityExpiry(
  now: Date,
  idleTtlMs: number,
  absoluteExpiresAt: Date,
): Date {
  return minDate(addMilliseconds(now, idleTtlMs), absoluteExpiresAt);
}

/** Returns whether enough database-clock time elapsed to persist activity again. */
export function shouldRecordAuthSessionActivity(lastActivityAt: Date, now: Date): boolean {
  return now.getTime() - lastActivityAt.getTime() >= AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS;
}
