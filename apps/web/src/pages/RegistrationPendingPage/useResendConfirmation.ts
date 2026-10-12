import { registrationRetryDelay } from '@app/auth/email-confirmation/registration-feedback';
import { useEmailConfirmation } from '@app/graphql/hooks/auth/mutations/useEmailConfirmation';
import { useEffect, useRef, useState } from 'react';

import { RESEND_FEEDBACK, RESEND_UI_WAIT_MS, type ResendFeedback } from './registration.constants';
import { useResendCountdown } from './useResendCountdown';

/** Owns local resend feedback; this timer is an affordance, not server cooldown authority. */
export function useResendConfirmation() {
  const { resend } = useEmailConfirmation();
  const running = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<null | ResendFeedback>(null);
  const [until, setUntil] = useState(0);
  const seconds = useResendCountdown(until);

  useEffect(
    /** Prevents completed requests from updating an abandoned route. */
    () => {
      mounted.current = true;

      /** Marks only this mount retired; the network request is bounded and not retried. */
      return () => {
        mounted.current = false;
      };
    },
    [],
  );

  /** Dispatches one generic request and displays only closed safe feedback. */
  async function submit(email: string): Promise<void> {
    if (running.current || until > Date.now()) {
      return;
    }

    running.current = true;
    setBusy(true);
    setFeedback(null);

    try {
      await resend(email);

      if (mounted.current) {
        setUntil(Date.now() + RESEND_UI_WAIT_MS);
        setFeedback(RESEND_FEEDBACK.ACCEPTED);
      }
    } catch (error) {
      if (mounted.current) {
        const delay = registrationRetryDelay(error);
        setFeedback(delay === null ? RESEND_FEEDBACK.ERROR : RESEND_FEEDBACK.RATE_LIMITED);

        if (delay !== null) {
          setUntil(Date.now() + delay);
        }
      }
    } finally {
      running.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  return { busy, feedback, seconds, submit };
}
