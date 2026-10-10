import { AUTH_ERROR_CODE, AUTH_ERROR_POLICY } from '@aspectloop/contracts/platform';

import { normalizeEmail } from '#app/core/utils/normalize-email';

import { PlatformAuthException } from '../platform-auth.exception';
import {
  IDENTITY_LIMITS,
  SIGN_IN_CHECK_OUTCOME,
  type SignInCheckOutcome,
} from './identity-limit.constants';

export interface SignInReservation {
  /** Settles exactly once; old-window outcomes release capacity but cannot mutate new failures. */
  settle(outcome: SignInCheckOutcome): void;
}

interface RegistrationWindow {
  attempts: number;
  expiresAt: number;
}

interface SignInState {
  pending: number;
  window: null | SignInWindow;
}

interface SignInWindow {
  expiresAt: number;
  failures: number;
}

/** Owns bounded process-local identity budgets without retaining credentials or using timers. */
export class AuthIdentityLimiter {
  private readonly registration = new Map<string, RegistrationWindow>();
  private readonly signIn = new Map<string, SignInState>();

  /** Uses the real clock/key bound in production and explicit deterministic bounds in tests. */
  constructor(
    private readonly now: () => number = Date.now,
    private readonly maximumKeys: number = IDENTITY_LIMITS.MAX_KEYS,
  ) {}

  /** Counts valid signup/resend admissions before work, without refunds or identity disclosure. */
  admitRegistration(email: string): boolean {
    const key = normalizeEmail(email);
    const now = this.now();
    let window = this.registration.get(key);

    if (!window || window.expiresAt <= now) {
      if (this.registration.size >= this.maximumKeys) {
        for (const [candidate, state] of this.registration) {
          if (state.expiresAt <= now) {
            this.registration.delete(candidate);
          }
        }
      }

      if (!this.registration.has(key) && this.registration.size >= this.maximumKeys) {
        return false;
      }

      window = { attempts: 0, expiresAt: now + IDENTITY_LIMITS.REGISTRATION_WINDOW_MS };
      this.registration.set(key, window);
    }

    if (window.attempts >= IDENTITY_LIMITS.REGISTRATION_ATTEMPTS) {
      return false;
    }

    window.attempts += 1;
    return true;
  }

  /** Reserves password-check capacity before lookup/bcrypt; failures plus all pending checks cap at five. */
  reserveSignIn(email: string): SignInReservation {
    const key = normalizeEmail(email);
    const now = this.now();
    let state = this.signIn.get(key);

    if (!state && this.signIn.size >= this.maximumKeys) {
      this.removeExpiredSignIn(now);
    }

    if (!state) {
      if (this.signIn.size >= this.maximumKeys) {
        this.reject(AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX);
      }

      state = { pending: 0, window: null };
      this.signIn.set(key, state);
    }

    if (!state.window || state.window.expiresAt <= now) {
      if (state.pending >= IDENTITY_LIMITS.SIGN_IN_ATTEMPTS) {
        this.reject(AUTH_ERROR_POLICY.RETRY_AFTER_MS_MIN);
      }

      state.window = { expiresAt: now + IDENTITY_LIMITS.SIGN_IN_WINDOW_MS, failures: 0 };
    }

    const window = state.window;

    if (window.failures + state.pending >= IDENTITY_LIMITS.SIGN_IN_ATTEMPTS) {
      this.reject(window.expiresAt - now);
    }

    state.pending += 1;
    const ownedState = state;
    let settled = false;

    return {
      /** Captures distinct state/window identity and keeps settlement idempotent. */
      settle: (outcome) => {
        if (settled) {
          return;
        }

        settled = true;
        ownedState.pending -= 1;

        if (ownedState.window === window && window.expiresAt > this.now()) {
          if (outcome === SIGN_IN_CHECK_OUTCOME.ACCEPTED) {
            ownedState.window = null;
          } else if (outcome === SIGN_IN_CHECK_OUTCOME.REJECTED) {
            window.failures += 1;
          }
        }

        if (
          ownedState.pending === 0 &&
          (!ownedState.window ||
            ownedState.window.failures === 0 ||
            ownedState.window.expiresAt <= this.now())
        ) {
          this.signIn.delete(key);
        }
      },
    };
  }

  /** Emits only bounded metadata, never the email key or precise in-flight timing. */
  private reject(retryAfterMs: number): never {
    throw new PlatformAuthException(
      AUTH_ERROR_CODE.RATE_LIMITED,
      'Authentication rate limit exceeded',
      Math.min(
        AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX,
        Math.max(AUTH_ERROR_POLICY.RETRY_AFTER_MS_MIN, Math.ceil(retryAfterMs)),
      ),
    );
  }

  /** Evicts expired accounting only when no outstanding check still owns physical capacity. */
  private removeExpiredSignIn(now: number): void {
    for (const [key, state] of this.signIn) {
      if (state.pending === 0 && (!state.window || state.window.expiresAt <= now)) {
        this.signIn.delete(key);
      }
    }
  }
}

/** Wires the normal production clock and bounded singleton maps through Nest. */
export function createAuthIdentityLimiter(): AuthIdentityLimiter {
  return new AuthIdentityLimiter();
}
