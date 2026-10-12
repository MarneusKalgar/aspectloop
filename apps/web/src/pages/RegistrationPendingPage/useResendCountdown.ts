import { useEffect, useState } from 'react';

import { RESEND_COUNTDOWN_TICK_MS } from './registration.constants';

/** Calculates from wall-clock time so throttled background ticks cannot extend a wait. */
export function remainingResendSeconds(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** Owns one feature-local presentation interval and releases it on expiry or unmount. */
export function useResendCountdown(until: number): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(
    /** Refreshes the displayed countdown when its deadline changes. */
    () => {
      if (!until) {
        setSeconds(0);
        return;
      }

      /** Publishes only remaining time, then retires an expired interval. */
      function tick(): void {
        const remaining = remainingResendSeconds(until, Date.now());
        setSeconds(remaining);

        if (!remaining) {
          clearInterval(timer);
        }
      }

      const timer = setInterval(tick, RESEND_COUNTDOWN_TICK_MS);
      tick();

      /** Releases the owned interval before another deadline or route lifetime. */
      return () => {
        clearInterval(timer);
      };
    },
    [until],
  );

  return seconds;
}
