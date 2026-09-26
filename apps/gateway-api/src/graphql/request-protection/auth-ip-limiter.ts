import { AUTH_RATE_LIMIT_ACTION, type AuthRateLimitAction } from './operation-policy';

export const MAX_AUTH_RETRY_MS = 3_600_000;

const MAX_IP_KEYS = 10_000;
const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const CONFIRMATION_WINDOW_MS = 60 * 1000;

interface LimitPolicy {
  attempts: number;
  windowMs: number;
}

interface WindowState {
  count: number;
  expiresAt: number;
}

const LIMITS: Readonly<Record<AuthRateLimitAction, Readonly<LimitPolicy>>> = Object.freeze({
  [AUTH_RATE_LIMIT_ACTION.CONFIRMATION]: Object.freeze({
    attempts: 10,
    windowMs: CONFIRMATION_WINDOW_MS,
  }),
  [AUTH_RATE_LIMIT_ACTION.REGISTRATION]: Object.freeze({
    attempts: 20,
    windowMs: REGISTRATION_WINDOW_MS,
  }),
  [AUTH_RATE_LIMIT_ACTION.SIGN_IN]: Object.freeze({
    attempts: 30,
    windowMs: SIGN_IN_WINDOW_MS,
  }),
});

/** Keeps bounded, process-local IP counters; no forwarding header is read. */
export class GatewayAuthIpLimiter {
  private readonly windows = new Map<string, WindowState>();

  /** Creates a limiter with an injectable clock for deterministic coverage. */
  constructor(private readonly now: () => number = Date.now) {}

  /** Counts one auth-root attempt or returns bounded retry metadata. */
  consume(action: AuthRateLimitAction, ip: string): null | number {
    const now = this.now();
    const key = `${action}:${ip}`;
    const current = this.windows.get(key);

    if (current && current.expiresAt > now) {
      if (current.count >= LIMITS[action].attempts) {
        return boundRetry(current.expiresAt - now);
      }

      current.count += 1;
      return null;
    }

    if (this.windows.size >= MAX_IP_KEYS) {
      this.removeExpired(now);
    }

    if (!this.windows.has(key) && this.windows.size >= MAX_IP_KEYS) {
      return MAX_AUTH_RETRY_MS;
    }

    this.windows.set(key, {
      count: 1,
      expiresAt: now + LIMITS[action].windowMs,
    });
    return null;
  }

  /** Frees only expired entries before admitting a new identity. */
  private removeExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}

/** Constrains public retry metadata to the accepted millisecond interval. */
export function boundRetry(value: number): number {
  return Math.min(MAX_AUTH_RETRY_MS, Math.max(1, Math.ceil(value)));
}
