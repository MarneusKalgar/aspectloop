import { canConfirm, CONFIRMATION_STATUS } from '@app/auth/email-confirmation/confirmation-status';
import { describe, expect, it } from 'vitest';

import { confirmationPresentation } from './confirmation-presentation';

describe('confirmation presentation', /** Groups exhaustive status and action projections. */ () => {
  /** Every state has explicit safe copy, severity, action visibility and busy semantics. */
  it('projects all six states consistently with explicit attempt admission', () => {
    const cases = [
      ['busy', 'info', 'auth.confirmation.confirming', true],
      ['invalid', 'warning', null, false],
      ['rateLimited', 'warning', 'auth.confirmation.retry', false],
      ['ready', 'info', 'auth.confirmation.confirm', false],
      ['success', 'success', null, false],
      ['unknown', 'warning', 'auth.confirmation.retry', false],
    ] as const;
    expect(Object.isFrozen(CONFIRMATION_STATUS)).toBe(true);
    expect(Object.values(CONFIRMATION_STATUS)).toHaveLength(cases.length);

    for (const [status, severity, actionKey, busy] of cases) {
      const presentation = confirmationPresentation(status);
      expect(presentation).toEqual({
        actionKey,
        busy,
        messageKey: `auth.confirmation.${status}`,
        severity,
      });
      expect(canConfirm(status)).toBe(actionKey !== null && !busy);
    }
  });
});
