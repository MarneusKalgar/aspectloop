import { deferred } from '@app/test/session-environment';
import { describe, expect, it, vi } from 'vitest';

import {
  ConfirmationAttempt,
  confirmationAttempt,
  initializeConfirmationAttempt,
} from './confirmation-attempt';

describe('private confirmation attempt', /** Groups explicit dispatch and private lifetime cases. */ () => {
  /** Startup and settled test setup retain the exact subscription owner identity. */
  it('initializes the stable document owner without replacing it', () => {
    const owner = confirmationAttempt;
    initializeConfirmationAttempt('fixture-secret');
    expect(confirmationAttempt).toBe(owner);
    expect(owner.getSnapshot()).toBe('ready');
    initializeConfirmationAttempt(null);
    expect(confirmationAttempt).toBe(owner);
    expect(owner.getSnapshot()).toBe('invalid');
  });

  /** Initialization cannot orphan an observer or replace a secret in an unfinished request. */
  it('rejects initialization while observed or busy', async () => {
    const attempt = new ConfirmationAttempt('fixture-secret');
    const unsubscribe = attempt.subscribe(
      /** Holds a presentation observer without publishing the token. */ () => undefined,
    );
    expect(
      /** Attempts replacement while React would still observe this owner. */ () =>
        attempt.initialize(null),
    ).toThrow('Confirmation attempt is already active');
    unsubscribe();
    const result = deferred<void>();
    const request = attempt.confirm(
      /** Holds one explicit consume after its observer has retired. */ () => result.promise,
    );
    expect(
      /** Attempts replacement during an unresolved consume. */ () => attempt.initialize(null),
    ).toThrow('Confirmation attempt is already active');
    result.resolve();
    await request;
    attempt.initialize(null);
    expect(attempt.getSnapshot()).toBe('invalid');
  });

  /** Rate limiting retains the token but never dispatches an automatic retry. */
  it('allows a rate-limited retry only after another explicit call', async () => {
    const attempt = new ConfirmationAttempt('fixture-secret');
    const execute = vi
      .fn()
      .mockRejectedValueOnce({ errors: [{ extensions: { code: 'AUTH_RATE_LIMITED' } }] })
      .mockResolvedValueOnce(undefined);
    await attempt.confirm(execute);
    expect(attempt.getSnapshot()).toBe('rateLimited');
    expect(execute).toHaveBeenCalledTimes(1);
    await attempt.confirm(execute);
    expect(attempt.getSnapshot()).toBe('success');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  /** Mount/subscription activity cannot consume; overlapping clicks share one owner. */
  it('dispatches explicitly once across observer remounts and clears after success', async () => {
    const attempt = new ConfirmationAttempt('fixture-secret');
    const result = deferred<void>();
    const execute = vi.fn(
      /** Holds consumption until its explicit response arrives. */ () => result.promise,
    );
    const unsubscribe = attempt.subscribe(
      /** Observes safe state without executing an action. */ () => undefined,
    );
    unsubscribe();
    expect(execute).not.toHaveBeenCalled();

    const first = attempt.confirm(execute);
    await attempt.confirm(execute);
    expect(attempt.getSnapshot()).toBe('busy');
    expect(execute).toHaveBeenCalledTimes(1);
    result.resolve();
    await first;
    expect(attempt.getSnapshot()).toBe('success');
    await attempt.confirm(execute);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  /** Unknown delivery preserves a secret for explicit retry, never an automatic loop. */
  it('requires another click after an unknown outcome and clears terminal invalidity', async () => {
    const attempt = new ConfirmationAttempt('fixture-secret');
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Controlled outage'))
      .mockRejectedValueOnce({ errors: [{ extensions: { code: 'AUTH_CONFIRMATION_INVALID' } }] });
    await attempt.confirm(execute);
    expect(attempt.getSnapshot()).toBe('unknown');
    expect(execute).toHaveBeenCalledTimes(1);
    await attempt.confirm(execute);
    expect(attempt.getSnapshot()).toBe('invalid');
    await attempt.confirm(execute);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
