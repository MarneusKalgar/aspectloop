import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RESEND_FEEDBACK } from './registration.constants';
import { useResendConfirmation } from './useResendConfirmation';

const { resend } = vi.hoisted(
  /** Provides a bounded test-local executor without Apollo state. */ () => ({ resend: vi.fn() }),
);
vi.mock(
  '@app/graphql/hooks/auth/mutations/useEmailConfirmation',
  /** Isolates local UI countdown ownership from network integration. */ () => ({
    useEmailConfirmation: /** Supplies the scoped mock request. */ () => ({ resend }),
  }),
);

afterEach(
  /** Restores time and mock outcomes without leaking timers into another test. */ () => {
    vi.useRealTimers();
    resend.mockReset();
  },
);

describe('resend UI ownership', /** Groups bounded feedback and timer disposal guarantees. */ () => {
  /** Locks safe feedback spelling independently of the hook's setters and page comparisons. */
  it('exposes frozen resend feedback without treating absence as an outcome', () => {
    expect(Object.isFrozen(RESEND_FEEDBACK)).toBe(true);
    expect(RESEND_FEEDBACK).toEqual({
      ACCEPTED: 'accepted',
      ERROR: 'error',
      RATE_LIMITED: 'rateLimited',
    });
  });

  /** Repeated clicks are locally suppressed and the single presentation timer is released. */
  it('waits after generic acknowledgement and clears its timer on unmount', async () => {
    vi.useFakeTimers();
    resend.mockResolvedValue(undefined);
    const view = renderHook(useResendConfirmation);
    expect(view.result.current.feedback).toBeNull();

    await act(
      /** Performs one explicit generic request. */ async () => {
        await view.result.current.submit('fixture@example.test');
      },
    );
    expect(view.result.current.feedback).toBe('accepted');
    expect(view.result.current.seconds).toBe(60);
    await act(
      /** Attempts a repeat during the UI-only waiting window. */ async () => {
        await view.result.current.submit('fixture@example.test');
      },
    );
    expect(resend).toHaveBeenCalledTimes(1);
    act(
      /** Advances only the local countdown, not server authority. */ () => {
        vi.advanceTimersByTime(60_000);
      },
    );
    expect(view.result.current.seconds).toBe(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  /** Supported server metadata determines rate feedback; native/private messages are never rendered. */
  it('uses a bounded server retry delay and keeps unknown failures neutral', async () => {
    vi.useFakeTimers();
    resend.mockRejectedValue({
      errors: [{ extensions: { code: 'AUTH_RATE_LIMITED', retryAfterMs: 2000 } }],
    });
    const view = renderHook(useResendConfirmation);
    await act(
      /** Supplies a controlled rate response. */ async () => {
        await view.result.current.submit('fixture@example.test');
      },
    );
    expect(view.result.current.feedback).toBe('rateLimited');
    expect(view.result.current.seconds).toBe(2);
    act(
      /** Allows only the advised delay to expire. */ () => {
        vi.advanceTimersByTime(2000);
      },
    );
    resend.mockRejectedValue(new TypeError('Fixture-only private error'));
    await act(
      /** Makes a new explicit request with a controlled unknown outcome. */ async () => {
        await view.result.current.submit('fixture@example.test');
      },
    );
    expect(view.result.current.feedback).toBe('error');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
