import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';

import type { ConfirmationStatus } from './confirmation-status';

import { getSessionErrorCode } from '../session-error';
import { canConfirm, CONFIRMATION_STATUS } from './confirmation-status';

export type { ConfirmationStatus } from './confirmation-status';

/** Owns the secret and explicit attempt across route/StrictMode remounts, not React or history state. */
export class ConfirmationAttempt {
  private readonly listeners = new Set<() => void>();
  private status: ConfirmationStatus;

  /** Stores one startup capture; an absent or malformed link is already terminal. */
  constructor(private token: null | string) {
    this.status = token ? CONFIRMATION_STATUS.READY : CONFIRMATION_STATUS.INVALID;
  }

  /** Consumes only after an explicit click; overlapping clicks cannot dispatch twice. */
  async confirm(execute: (token: string) => Promise<void>): Promise<void> {
    if (!this.token || !canConfirm(this.status)) {
      return;
    }

    this.update(CONFIRMATION_STATUS.BUSY);

    try {
      await execute(this.token);
      this.token = null;
      this.update(CONFIRMATION_STATUS.SUCCESS);
    } catch (error) {
      const code = getSessionErrorCode(error);

      if (code === AUTH_ERROR_CODE.CONFIRMATION_INVALID) {
        this.token = null;
        this.update(CONFIRMATION_STATUS.INVALID);
      } else if (code === AUTH_ERROR_CODE.RATE_LIMITED) {
        this.update(CONFIRMATION_STATUS.RATE_LIMITED);
      } else {
        // Delivery/consumption may have happened. Only another explicit click can retry.
        this.update(CONFIRMATION_STATUS.UNKNOWN);
      }
    }
  }

  /** Exposes only safe presentation state to React. */
  getSnapshot = (): ConfirmationStatus => this.status;

  /** Initializes the stable owner only before observation or between settled test lifetimes. */
  initialize(token: null | string): void {
    if (this.listeners.size !== 0 || this.status === CONFIRMATION_STATUS.BUSY) {
      throw new Error('Confirmation attempt is already active');
    }

    this.token = token;
    this.status = token ? CONFIRMATION_STATUS.READY : CONFIRMATION_STATUS.INVALID;
  }

  /** Tracks only presentation listeners and releases them on unmount. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    /** Removes this observer without discarding a still-pending private attempt. */
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Publishes safe state without copying the token into subscription payloads. */
  private update(status: ConfirmationStatus): void {
    this.status = status;

    for (const listener of this.listeners) {
      listener();
    }
  }
}

// The startup entry point initializes this once before importing App/router.
export const confirmationAttempt = new ConfirmationAttempt(null);

/** Initializes the existing startup owner without replacing React's subscription target. */
export function initializeConfirmationAttempt(token: null | string): void {
  confirmationAttempt.initialize(token);
}
