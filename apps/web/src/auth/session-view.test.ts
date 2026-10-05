import { describe, expect, it } from 'vitest';

import type { CoordinationSnapshot } from './session-coordination/session-coordinator';

import { INITIAL_SESSION_MARKER, type SessionMarker } from './session-coordination/session-marker';
import { BROWSER_SESSION_ERROR_CODE } from './session-error';
import {
  ANONYMOUS_SESSION,
  getSignInRejectionMessageKey,
  selectSessionView,
  type SessionNotice,
  type SessionResolution,
} from './session-view';
import { BROWSER_AUTH_STATUS, type BrowserAuthStatus } from './session.types';

const actionId = '00000000-0000-4000-8000-000000000001';
const confirmed: SessionMarker = {
  ...INITIAL_SESSION_MARKER,
  logoutIntent: true,
  revocation: 'confirmed',
};
const unconfirmed: SessionMarker = { ...confirmed, revocation: 'unconfirmed' };
const pending: SessionMarker = {
  ...INITIAL_SESSION_MARKER,
  action: { id: actionId, kind: 'sign-in', status: 'pending' },
};
const unknown: SessionMarker = {
  ...unconfirmed,
  action: { id: actionId, kind: 'sign-in', status: 'unknown' },
};
const resolved: SessionResolution = { kind: 'resolved', revision: 10, session: ANONYMOUS_SESSION };
const cacheFailed: SessionResolution = { kind: 'cache-failed', revision: 10 };

interface ViewCase {
  actions: boolean;
  localSignOut?: boolean;
  name: string;
  notice?: SessionNotice;
  resolution?: SessionResolution;
  snapshot?: Partial<CoordinationSnapshot>;
  status: BrowserAuthStatus;
  supported?: boolean;
  unsupported?: boolean;
}

const cases: ViewCase[] = [
  { actions: true, name: 'current anonymous resolution', status: 'anonymous' },
  {
    actions: true,
    name: 'retired resolution',
    resolution: { ...resolved, revision: 9 },
    status: 'loading',
  },
  {
    actions: true,
    name: 'pending bootstrap',
    resolution: { kind: 'pending', revision: 10 },
    status: 'loading',
  },
  {
    actions: false,
    localSignOut: true,
    name: 'pending login',
    snapshot: { marker: pending },
    status: 'loading',
  },
  {
    actions: false,
    name: 'pending action with logout intent',
    snapshot: { marker: { ...pending, logoutIntent: true, revocation: 'unconfirmed' } },
    status: 'loading',
  },
  {
    actions: true,
    name: 'confirmed logout precedes transient outage',
    snapshot: { failure: 'unavailable', marker: confirmed },
    status: 'anonymous',
  },
  {
    actions: false,
    name: 'local suppression precedes confirmed logout',
    notice: { messageKey: 'auth.session.logoutUnconfirmed', recovery: 'retry-sign-out' },
    snapshot: { localLogout: true, marker: confirmed },
    status: 'unavailable',
  },
  {
    actions: false,
    name: 'completed unconfirmed revocation',
    notice: { messageKey: 'auth.session.logoutUnconfirmed', recovery: 'retry-sign-out' },
    snapshot: { marker: unconfirmed },
    status: 'unavailable',
  },
  {
    actions: false,
    name: 'unknown action requires manual reset',
    notice: { messageKey: 'auth.session.resetRequired', recovery: 'none' },
    snapshot: { marker: unknown },
    status: 'unavailable',
  },
  {
    actions: false,
    name: 'missing marker outranks cache failure',
    notice: { messageKey: 'auth.session.resetRequired', recovery: 'none' },
    resolution: cacheFailed,
    snapshot: { marker: null },
    status: 'unavailable',
  },
  {
    actions: false,
    localSignOut: true,
    name: 'cache failure outranks pending action',
    notice: { messageKey: 'auth.session.unavailable', recovery: 'retry-bootstrap' },
    resolution: cacheFailed,
    snapshot: { marker: pending },
    status: 'unavailable',
  },
  {
    actions: false,
    name: 'cache failure retries retirement, not revocation',
    notice: { messageKey: 'auth.session.logoutUnconfirmed', recovery: 'retry-bootstrap' },
    resolution: cacheFailed,
    snapshot: { marker: unconfirmed },
    status: 'unavailable',
  },
  { actions: true, name: 'invalid session', snapshot: { failure: 'invalid' }, status: 'anonymous' },
  {
    actions: true,
    name: 'ordinary outage',
    notice: { messageKey: 'auth.session.unavailable', recovery: 'retry-bootstrap' },
    snapshot: { failure: 'unavailable' },
    status: 'unavailable',
  },
  {
    actions: false,
    name: 'unsupported anonymous browser',
    status: 'anonymous',
    supported: false,
    unsupported: true,
  },
  {
    actions: false,
    name: 'unsupported logout cannot retry cookie mutation',
    notice: { messageKey: 'auth.session.logoutUnconfirmed', recovery: 'none' },
    snapshot: { marker: unconfirmed },
    status: 'unavailable',
    supported: false,
    unsupported: true,
  },
  {
    actions: false,
    name: 'unsupported ordinary outage can retry reads',
    notice: { messageKey: 'auth.session.unavailable', recovery: 'retry-bootstrap' },
    snapshot: { failure: 'unavailable' },
    status: 'unavailable',
    supported: false,
  },
];

describe('session presentation policy' /** Exercises precedence without mounting effects or issuing requests. */, () => {
  it.each(cases)(
    '$name',
    /** Verifies outcome, recovery, and capabilities from one immutable snapshot. */
    (scenario) => {
      const snapshot: CoordinationSnapshot = {
        failure: null,
        localLogout: false,
        marker: INITIAL_SESSION_MARKER,
        revision: 10,
        ...scenario.snapshot,
      };
      const view = selectSessionView(
        snapshot,
        scenario.resolution ?? resolved,
        scenario.supported ?? true,
      );
      expect(view.session.status).toBe(scenario.status);
      expect(view.accountActionsAvailable).toBe(scenario.actions);
      expect(view.localSignOutAvailable).toBe(scenario.localSignOut ?? false);
      expect(view.notice).toEqual(scenario.notice ?? null);
      expect(view.unsupported).toBe(scenario.unsupported ?? false);
    },
  );

  it('never renders identity from an obsolete resolution' /** Models old Me success arriving after a new generation was published. */, () => {
    const authenticated: SessionResolution = {
      kind: 'resolved',
      revision: 9,
      session: {
        status: BROWSER_AUTH_STATUS.AUTHENTICATED,
        user: {
          createdAt: '',
          displayName: 'Reviewer',
          email: 'reviewer@example.test',
          id: actionId,
          roles: ['CORRECTOR'],
          scopes: ['corrections:write'],
          updatedAt: '',
        },
      },
    };
    const snapshot: CoordinationSnapshot = {
      failure: null,
      localLogout: false,
      marker: INITIAL_SESSION_MARKER,
      revision: 10,
    };
    expect(selectSessionView(snapshot, authenticated, true).session.user).toBeNull();
    expect(selectSessionView(snapshot, { ...authenticated, revision: 10 }, true).session).toEqual(
      authenticated.session,
    );
  });

  it('uses only fixed translation keys for expected rejection feedback' /** Unknown codes cannot inject server messages into public presentation. */, () => {
    expect(getSignInRejectionMessageKey(BROWSER_SESSION_ERROR_CODE.EMAIL_UNVERIFIED)).toBe(
      'auth.session.emailRequired',
    );
    expect(getSignInRejectionMessageKey(BROWSER_SESSION_ERROR_CODE.RATE_LIMITED)).toBe(
      'auth.session.rateLimited',
    );
    expect(getSignInRejectionMessageKey('unknown')).toBe('auth.signIn.error');
    expect(getSignInRejectionMessageKey(null)).toBe('auth.signIn.error');
  });
});
