import type { AuthRateLimitPolicy } from './operation-policy';

export const MAX_AUTH_RETRY_MS = 3_600_000;

const MAX_IP_KEYS = 10_000;

interface WindowState {
  count: number;
  expiresAt: number;
}

/** Keeps bounded, process-local IP counters; no forwarding header is read. */
export class GatewayAuthIpLimiter {
  private readonly windows = new Map<string, WindowState>();

  /** Creates a limiter with an injectable clock for deterministic coverage. */
  constructor(private readonly now: () => number = Date.now) {}

  /** Enforces one declared auth limit policy for an IP-derived identity. */
  consume(policy: AuthRateLimitPolicy, ip: string): null | number {
    const now = this.now();
    const key = `${policy.group}:${ip}`;
    const current = this.windows.get(key);

    if (current && current.expiresAt > now) {
      if (current.count >= policy.attempts) {
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
      expiresAt: now + policy.windowMs,
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
