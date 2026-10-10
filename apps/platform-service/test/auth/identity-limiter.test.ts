import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { AuthIdentityLimiter } from '@platform/auth/limits/auth-identity-limiter';
import {
  IDENTITY_LIMITS,
  SIGN_IN_CHECK_OUTCOME as OUTCOME,
} from '@platform/auth/limits/identity-limit.constants';
import { expect, test } from 'vitest';

const EMAIL = 'reviewer@example.test';

/** Proves capacity fails closed, expired entries reclaim space and pending entries cannot be evicted. */
function boundedCapacity(): void {
  let now = 0;
  const limiter = new AuthIdentityLimiter(
    /** Supplies the test-controlled wall clock. */ () => now,
    1,
  );
  expect(limiter.admitRegistration(EMAIL)).toBe(true);
  expect(limiter.admitRegistration('other@example.test')).toBe(false);
  const reservation = limiter.reserveSignIn(EMAIL);
  now = IDENTITY_LIMITS.REGISTRATION_WINDOW_MS;
  expect(limiter.admitRegistration('other@example.test')).toBe(true);
  expect(
    /** Refuses to evict a still-pending identity for a new key. */ () =>
      limiter.reserveSignIn('other@example.test'),
  ).toThrow();
  reservation.settle(OUTCOME.RELEASED);
  limiter.reserveSignIn('other@example.test').settle(OUTCOME.RELEASED);
}

/** Proves exceptions release capacity without credential failure and duplicate settlement is harmless. */
function exceptionRelease(): void {
  const limiter = new AuthIdentityLimiter();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reservation = limiter.reserveSignIn(EMAIL);
    reservation.settle(OUTCOME.RELEASED);
    reservation.settle(OUTCOME.REJECTED);
  }

  limiter.reserveSignIn(EMAIL).settle(OUTCOME.RELEASED);
}

/** Proves expiry/reset retains physical pending capacity while excluding old outcomes from new failures. */
function expiryWithPending(): void {
  let now = 0;
  const limiter = new AuthIdentityLimiter(
    /** Supplies the test-controlled wall clock. */ () => now,
  );
  const pending = Array.from(
    { length: 5 },
    /** Starts all old-window checks before expiry. */ () => limiter.reserveSignIn(EMAIL),
  );
  now = IDENTITY_LIMITS.SIGN_IN_WINDOW_MS;
  expect(
    /** Attempts admission while every physical slot is still owned. */ () =>
      limiter.reserveSignIn(EMAIL),
  ).toThrow();
  pending[0]?.settle(OUTCOME.REJECTED);
  const current = limiter.reserveSignIn(EMAIL);

  for (const reservation of pending.slice(1)) {
    reservation.settle(OUTCOME.REJECTED);
  }

  current.settle(OUTCOME.REJECTED);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    limiter.reserveSignIn(EMAIL).settle(OUTCOME.REJECTED);
  }

  expect(
    /** Checks that only the successor window's failures exhaust its budget. */ () =>
      limiter.reserveSignIn(EMAIL),
  ).toThrow();
}

/** Proves five failures are credential work and the sixth admission is rate-limited. */
function failedThreshold(): void {
  let now = 0;
  const limiter = new AuthIdentityLimiter(
    /** Supplies the test-controlled wall clock. */ () => now,
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    limiter.reserveSignIn(EMAIL).settle(OUTCOME.REJECTED);
  }

  expect(
    /** Attempts the sixth check without bypassing production admission. */ () =>
      limiter.reserveSignIn(EMAIL),
  ).toThrow(
    expect.objectContaining({
      response: expect.objectContaining({
        code: AUTH_ERROR_CODE.RATE_LIMITED,
        retryAfterMs: IDENTITY_LIMITS.SIGN_IN_WINDOW_MS,
      }),
    }),
  );
  now = IDENTITY_LIMITS.SIGN_IN_WINDOW_MS;
  limiter.reserveSignIn(EMAIL).settle(OUTCOME.RELEASED);
}

/** Proves provisional reservations stop parallel bcrypt checks from bypassing the failure budget. */
function parallelAdmission(): void {
  const limiter = new AuthIdentityLimiter();
  const pending = Array.from(
    { length: 5 },
    /** Starts all checks before any result may settle. */ () => limiter.reserveSignIn(EMAIL),
  );
  expect(/** Attempts one more provisional slot. */ () => limiter.reserveSignIn(EMAIL)).toThrow();

  for (const reservation of pending) {
    reservation.settle(OUTCOME.REJECTED);
    reservation.settle(OUTCOME.RELEASED);
  }

  expect(
    /** Rechecks the budget after all five failures settled. */ () => limiter.reserveSignIn(EMAIL),
  ).toThrow();
}

/** Proves fixed-window registration accounting is normalized and shared, with no refunds. */
function registrationWindow(): void {
  let now = 0;
  const limiter = new AuthIdentityLimiter(
    /** Supplies the test-controlled wall clock. */ () => now,
  );
  expect(limiter.admitRegistration(' Reviewer@Example.Test ')).toBe(true);
  now += 1000;
  expect(limiter.admitRegistration(EMAIL)).toBe(true);
  expect(limiter.admitRegistration(EMAIL)).toBe(true);
  expect(limiter.admitRegistration(EMAIL)).toBe(false);
  now = IDENTITY_LIMITS.REGISTRATION_WINDOW_MS - 1;
  expect(limiter.admitRegistration(EMAIL)).toBe(false);
  now += 1;
  expect(limiter.admitRegistration(EMAIL)).toBe(true);
}

/** Proves late failures and successes cannot overwrite the post-success generation. */
function successReset(): void {
  const limiter = new AuthIdentityLimiter();
  const oldFailure = limiter.reserveSignIn(EMAIL);
  const oldSuccess = limiter.reserveSignIn(EMAIL);
  limiter.reserveSignIn(EMAIL).settle(OUTCOME.ACCEPTED);
  limiter.reserveSignIn(EMAIL).settle(OUTCOME.REJECTED);
  oldFailure.settle(OUTCOME.REJECTED);
  oldSuccess.settle(OUTCOME.ACCEPTED);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    limiter.reserveSignIn(EMAIL).settle(OUTCOME.REJECTED);
  }

  expect(
    /** Confirms late old outcomes did not erase the new failures. */ () =>
      limiter.reserveSignIn(EMAIL),
  ).toThrow();
}

/** Proves password success clears failures but cannot create extra physical checks while peers remain pending. */
function successWithPendingCapacity(): void {
  const limiter = new AuthIdentityLimiter();
  const pending = Array.from(
    { length: 5 },
    /** Holds all old checks until the explicit success cut-point. */ () =>
      limiter.reserveSignIn(EMAIL),
  );
  pending[0]?.settle(OUTCOME.ACCEPTED);
  const current = limiter.reserveSignIn(EMAIL);
  expect(
    /** Attempts to exceed retained pending capacity after success. */ () =>
      limiter.reserveSignIn(EMAIL),
  ).toThrow();

  for (const reservation of pending.slice(1)) {
    reservation.settle(OUTCOME.REJECTED);
  }

  current.settle(OUTCOME.REJECTED);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    limiter.reserveSignIn(EMAIL).settle(OUTCOME.REJECTED);
  }

  expect(
    /** Confirms only the successor's five failures exhaust its budget. */ () =>
      limiter.reserveSignIn(EMAIL),
  ).toThrow();
}

test('registration uses normalized fixed windows without refunds', registrationWindow);
test('five failures block the next check until window expiry', failedThreshold);
test('parallel pending checks reserve the whole failure budget', parallelAdmission);
test('old outcomes cannot modify a password-success successor', successReset);
test('password success retains pending physical capacity', successWithPendingCapacity);
test('expiry retains pending work without importing old failures', expiryWithPending);
test('capacity cleanup never evicts owned pending work', boundedCapacity);
test('exception release settles once without counting failure', exceptionRelease);
