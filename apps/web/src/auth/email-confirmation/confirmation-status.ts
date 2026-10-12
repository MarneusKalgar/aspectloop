/** Safe presentation vocabulary; never carries the private confirmation token. */
export const CONFIRMATION_STATUS = Object.freeze({
  BUSY: 'busy',
  INVALID: 'invalid',
  RATE_LIMITED: 'rateLimited',
  READY: 'ready',
  SUCCESS: 'success',
  UNKNOWN: 'unknown',
} as const);

export type ConfirmationStatus = (typeof CONFIRMATION_STATUS)[keyof typeof CONFIRMATION_STATUS];

/** Allows only a new explicit attempt or a human-selected retry. */
export function canConfirm(status: ConfirmationStatus): boolean {
  return (
    status === CONFIRMATION_STATUS.READY ||
    status === CONFIRMATION_STATUS.UNKNOWN ||
    status === CONFIRMATION_STATUS.RATE_LIMITED
  );
}
