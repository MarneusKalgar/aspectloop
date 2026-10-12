import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { remainingResendSeconds, useResendCountdown } from './useResendCountdown';

afterEach(
  /** Restores the real clock after releasing the test-owned hook. */ () => {
    vi.useRealTimers();
  },
);

describe('resend countdown', /** Groups pure wall-clock arithmetic and interval ownership. */ () => {
  /** Fractions round up while expired deadlines clamp to zero. */
  it('calculates remaining seconds without extending an expired wait', () => {
    expect(remainingResendSeconds(60_000, 0)).toBe(60);
    expect(remainingResendSeconds(60_000, 59_001)).toBe(1);
    expect(remainingResendSeconds(60_000, 60_000)).toBe(0);
    expect(remainingResendSeconds(60_000, 70_000)).toBe(0);
  });

  /** A new deadline replaces the sole timer, and wall-clock jumps cannot prolong it. */
  it('replaces its interval and releases it after a throttled-clock expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const view = renderHook(
      /** Supplies only a local UI deadline, not Platform cooldown authority. */ ({ until }) =>
        useResendCountdown(until),
      { initialProps: { until: 60_000 } },
    );
    expect(view.result.current).toBe(60);
    expect(vi.getTimerCount()).toBe(1);
    view.rerender({ until: 0 });
    expect(view.result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    view.rerender({ until: 120_000 });
    expect(view.result.current).toBe(120);
    expect(vi.getTimerCount()).toBe(1);

    act(
      /** Models background throttling by advancing wall time before the next tick. */ () => {
        vi.setSystemTime(120_000);
        vi.advanceTimersByTime(1000);
      },
    );

    expect(view.result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
