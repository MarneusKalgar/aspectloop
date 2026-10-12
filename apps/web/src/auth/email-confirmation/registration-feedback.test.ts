import { describe, expect, it } from 'vitest';

import { registrationRetryDelay } from './registration-feedback';

describe('registration retry feedback', /** Groups closed rate-limit metadata admission cases. */ () => {
  /** Independent literals lock the inclusive public contract boundaries and cause traversal. */
  it('admits both boundaries and skips unsupported metadata', () => {
    for (const retryAfterMs of [1, 3_600_000]) {
      expect(
        registrationRetryDelay({
          cause: { errors: [null, { extensions: { code: 'AUTH_RATE_LIMITED', retryAfterMs } }] },
        }),
      ).toBe(retryAfterMs);
    }

    for (const extensions of [null, false, 'private', {}, { code: 'AUTH_RATE_LIMITED' }]) {
      expect(registrationRetryDelay({ extensions })).toBeNull();
    }
  });

  /** Only supported rate-limit codes with safe integer bounds affect a timer. */
  it('rejects unsupported, fractional and unbounded retry values', () => {
    expect(
      registrationRetryDelay({
        errors: [{ extensions: { code: 'AUTH_RATE_LIMITED', retryAfterMs: 60_000 } }],
      }),
    ).toBe(60_000);

    for (const retryAfterMs of [0, -1, 1.5, 3_600_001, Infinity, '60000']) {
      expect(
        registrationRetryDelay({ extensions: { code: 'AUTH_RATE_LIMITED', retryAfterMs } }),
      ).toBeNull();
    }

    expect(
      registrationRetryDelay({
        extensions: { code: 'AUTH_DEPENDENCY_UNAVAILABLE', retryAfterMs: 1000 },
      }),
    ).toBeNull();
  });
});
