import { describe, expect, it } from 'vitest';

import {
  INITIAL_SESSION_MARKER,
  parseSessionMarker,
  SESSION_ACTION_KIND,
  SESSION_ACTION_STATUS,
  SESSION_REVOCATION,
  type SessionMarker,
} from './session-marker';

const id = '00000000-0000-4000-8000-000000000001';
const consistencyError = 'Session coordination storage is unavailable';

/** Exercises every action/intent/revocation combination against an explicit allowed-state table. */
function testConsistencyMatrix(): void {
  const unconfirmedStates: Pick<SessionMarker, 'logoutIntent' | 'revocation'>[] = [
    { logoutIntent: true, revocation: SESSION_REVOCATION.UNCONFIRMED },
  ];
  const ordinaryStates: typeof unconfirmedStates = [
    { logoutIntent: false, revocation: SESSION_REVOCATION.NONE },
    ...unconfirmedStates,
    { logoutIntent: true, revocation: SESSION_REVOCATION.CONFIRMED },
  ];
  const actions: { action: SessionMarker['action']; allowed: typeof ordinaryStates }[] = [
    { action: null, allowed: ordinaryStates },
  ];

  for (const kind of Object.values(SESSION_ACTION_KIND)) {
    for (const status of Object.values(SESSION_ACTION_STATUS)) {
      let allowed: typeof ordinaryStates = [];

      if (status === SESSION_ACTION_STATUS.PENDING) {
        allowed = ordinaryStates;
      } else if (
        status === SESSION_ACTION_STATUS.UNKNOWN ||
        kind === SESSION_ACTION_KIND.SIGN_OUT
      ) {
        allowed = unconfirmedStates;
      }

      actions.push({ action: { id, kind, status }, allowed });
    }
  }

  for (const { action, allowed } of actions) {
    for (const logoutIntent of [false, true]) {
      for (const revocation of Object.values(SESSION_REVOCATION)) {
        const marker: SessionMarker = {
          ...INITIAL_SESSION_MARKER,
          action,
          epoch: id,
          logoutIntent,
          revocation,
        };
        const accepted = allowed.some(
          /** Uses the allowed-state table without repeating the parser's compound conditions. */
          (state) => state.logoutIntent === logoutIntent && state.revocation === revocation,
        );

        if (accepted) {
          expect(parseSessionMarker(JSON.stringify(marker))).toEqual(marker);
        } else {
          expect(
            /** Inconsistent wire records keep the established fixed storage error. */
            () => parseSessionMarker(JSON.stringify(marker)),
          ).toThrow(consistencyError);
        }
      }
    }
  }
}

/** Pins runtime immutability and persisted strings independently of the schema's constants. */
function testFrozenValues(): void {
  expect(SESSION_ACTION_KIND).toEqual({ SIGN_IN: 'sign-in', SIGN_OUT: 'sign-out' });
  expect(SESSION_ACTION_STATUS).toEqual({
    FAILED: 'failed',
    PENDING: 'pending',
    READY: 'ready',
    UNKNOWN: 'unknown',
  });
  expect(SESSION_REVOCATION).toEqual({
    CONFIRMED: 'confirmed',
    NONE: 'none',
    UNCONFIRMED: 'unconfirmed',
  });

  for (const constants of [SESSION_ACTION_KIND, SESSION_ACTION_STATUS, SESSION_REVOCATION]) {
    expect(Object.isFrozen(constants)).toBe(true);
  }
}

/** Constant property names and unknown strings must not become accepted persisted values. */
function testUnknownValues(): void {
  const marker: SessionMarker = {
    ...INITIAL_SESSION_MARKER,
    action: { id, kind: SESSION_ACTION_KIND.SIGN_OUT, status: SESSION_ACTION_STATUS.READY },
    epoch: id,
    logoutIntent: true,
    revocation: SESSION_REVOCATION.UNCONFIRMED,
  };

  for (const invalid of [
    { ...marker, action: { ...marker.action, kind: 'SIGN_OUT' } },
    { ...marker, action: { ...marker.action, kind: 'other-action' } },
    { ...marker, action: { ...marker.action, status: 'READY' } },
    { ...marker, action: { ...marker.action, status: 'other-status' } },
    { ...marker, revocation: 'UNCONFIRMED' },
    { ...marker, revocation: 'other-revocation' },
  ]) {
    expect(
      /** Structural enum validation still rejects keys and unsupported values. */
      () => parseSessionMarker(JSON.stringify(invalid)),
    ).toThrow();
  }
}

describe('session marker constants and consistency' /** Preserves the stored vocabulary and parser rules through the readability refactor. */, () => {
  it('freezes constants without changing persisted strings', testFrozenValues);
  it('preserves all action, intent and revocation consistency decisions', testConsistencyMatrix);
  it('rejects enum keys and unknown stored values', testUnknownValues);
});
