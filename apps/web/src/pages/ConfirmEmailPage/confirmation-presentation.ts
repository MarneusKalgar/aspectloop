import type { ConfirmationStatus } from '@app/auth/email-confirmation/confirmation-status';

import { CONFIRMATION_STATUS } from '@app/auth/email-confirmation/confirmation-status';

interface ConfirmationPresentation {
  readonly actionKey:
    'auth.confirmation.confirm' | 'auth.confirmation.confirming' | 'auth.confirmation.retry' | null;
  readonly busy: boolean;
  readonly messageKey: `auth.confirmation.${ConfirmationStatus}`;
  readonly severity: 'info' | 'success' | 'warning';
}

const PRESENTATION = {
  [CONFIRMATION_STATUS.BUSY]: {
    actionKey: 'auth.confirmation.confirming',
    busy: true,
    messageKey: 'auth.confirmation.busy',
    severity: 'info',
  },
  [CONFIRMATION_STATUS.INVALID]: {
    actionKey: null,
    busy: false,
    messageKey: 'auth.confirmation.invalid',
    severity: 'warning',
  },
  [CONFIRMATION_STATUS.RATE_LIMITED]: {
    actionKey: 'auth.confirmation.retry',
    busy: false,
    messageKey: 'auth.confirmation.rateLimited',
    severity: 'warning',
  },
  [CONFIRMATION_STATUS.READY]: {
    actionKey: 'auth.confirmation.confirm',
    busy: false,
    messageKey: 'auth.confirmation.ready',
    severity: 'info',
  },
  [CONFIRMATION_STATUS.SUCCESS]: {
    actionKey: null,
    busy: false,
    messageKey: 'auth.confirmation.success',
    severity: 'success',
  },
  [CONFIRMATION_STATUS.UNKNOWN]: {
    actionKey: 'auth.confirmation.retry',
    busy: false,
    messageKey: 'auth.confirmation.unknown',
    severity: 'warning',
  },
} as const satisfies Record<ConfirmationStatus, ConfirmationPresentation>;

/** Projects every safe status into exhaustive presentation metadata, never a secret. */
export function confirmationPresentation(status: ConfirmationStatus): ConfirmationPresentation {
  return PRESENTATION[status];
}
