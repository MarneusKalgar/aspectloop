import type { CoordinationSnapshot } from './session-coordination/session-coordinator';
import type { SessionState } from './session.types';

import {
  requiresSessionReset,
  SESSION_ACTION_STATUS,
  SESSION_REVOCATION,
} from './session-coordination/session-marker';
import { BROWSER_SESSION_ERROR_CODE } from './session-error';
import { BROWSER_AUTH_STATUS } from './session.types';

export const LOADING_SESSION: SessionState = { status: BROWSER_AUTH_STATUS.LOADING, user: null };
export const ANONYMOUS_SESSION: SessionState = {
  status: BROWSER_AUTH_STATUS.ANONYMOUS,
  user: null,
};
export const UNAVAILABLE_SESSION: SessionState = {
  status: BROWSER_AUTH_STATUS.UNAVAILABLE,
  user: null,
};

export interface SessionNotice {
  messageKey:
    'auth.session.logoutUnconfirmed' | 'auth.session.resetRequired' | 'auth.session.unavailable';
  recovery: SessionRecovery;
}

export type SessionRecovery = 'none' | 'retry-bootstrap' | 'retry-sign-out';

export type SessionResolution =
  | { kind: 'cache-failed' | 'pending'; revision: number }
  | { kind: 'resolved'; revision: number; session: SessionState };

export interface SessionView {
  accountActionsAvailable: boolean;
  localSignOutAvailable: boolean;
  notice: null | SessionNotice;
  session: SessionState;
  unsupported: boolean;
}

interface SessionConditions {
  cacheFault: boolean;
  confirmedLogout: boolean;
  pending: boolean;
  suppressed: boolean;
  unresolved: boolean;
}

/** Maps only expected sign-in rejection codes to fixed public translation keys. */
export function getSignInRejectionMessageKey(code: null | string) {
  if (code === BROWSER_SESSION_ERROR_CODE.EMAIL_UNVERIFIED) {
    return 'auth.session.emailRequired';
  }

  if (code === BROWSER_SESSION_ERROR_CODE.RATE_LIMITED) {
    return 'auth.session.rateLimited';
  }

  return 'auth.signIn.error';
}

/** Projects coordination and bootstrap into presentation without mutating either owner. */
export function selectSessionView(
  snapshot: CoordinationSnapshot,
  resolution: SessionResolution,
  supported: boolean,
): SessionView {
  const conditions = inspectConditions(snapshot, resolution);
  const session = selectSessionState(snapshot, resolution, conditions);
  const unavailable = session.status === BROWSER_AUTH_STATUS.UNAVAILABLE;
  const usable =
    session.status === BROWSER_AUTH_STATUS.ANONYMOUS ||
    session.status === BROWSER_AUTH_STATUS.AUTHENTICATED;
  return {
    accountActionsAvailable:
      supported &&
      !conditions.cacheFault &&
      !conditions.unresolved &&
      !conditions.pending &&
      !snapshot.localLogout &&
      (!snapshot.marker?.logoutIntent || conditions.confirmedLogout),
    localSignOutAvailable: conditions.pending && !conditions.suppressed,
    notice: unavailable ? selectNotice(conditions, supported) : null,
    session,
    unsupported: !supported && (usable || (unavailable && conditions.suppressed)),
  };
}

/** Derives browser-only conditions once, without reading storage or granting server authority. */
function inspectConditions(
  snapshot: CoordinationSnapshot,
  resolution: SessionResolution,
): SessionConditions {
  const { marker, revision } = snapshot;

  return {
    cacheFault: resolution.revision === revision && resolution.kind === 'cache-failed',
    confirmedLogout:
      !!marker?.logoutIntent &&
      marker.revocation === SESSION_REVOCATION.CONFIRMED &&
      !marker.action,
    pending: marker?.action?.status === SESSION_ACTION_STATUS.PENDING,
    suppressed: snapshot.localLogout || !!marker?.logoutIntent,
    unresolved: requiresSessionReset(marker),
  };
}

/** Selects the warning and its permitted recovery together, preserving reset priority. */
function selectNotice(conditions: SessionConditions, supported: boolean): SessionNotice {
  if (conditions.unresolved) {
    return { messageKey: 'auth.session.resetRequired', recovery: 'none' };
  }

  if (conditions.cacheFault) {
    const messageKey = conditions.suppressed
      ? 'auth.session.logoutUnconfirmed'
      : 'auth.session.unavailable';
    return { messageKey, recovery: 'retry-bootstrap' };
  }

  if (conditions.suppressed) {
    const recovery = supported && !conditions.pending ? 'retry-sign-out' : 'none';
    return { messageKey: 'auth.session.logoutUnconfirmed', recovery };
  }

  return { messageKey: 'auth.session.unavailable', recovery: 'retry-bootstrap' };
}

/** Keeps the original state precedence explicit; an obsolete resolution never exposes identity. */
function selectSessionState(
  snapshot: CoordinationSnapshot,
  resolution: SessionResolution,
  conditions: SessionConditions,
): SessionState {
  if (conditions.cacheFault || conditions.unresolved) {
    return UNAVAILABLE_SESSION;
  }

  if (conditions.pending) {
    return LOADING_SESSION;
  }

  if (conditions.confirmedLogout && !snapshot.localLogout) {
    return ANONYMOUS_SESSION;
  }

  if (conditions.suppressed || snapshot.failure === 'unavailable') {
    return UNAVAILABLE_SESSION;
  }

  if (snapshot.failure === 'invalid') {
    return ANONYMOUS_SESSION;
  }

  if (resolution.revision === snapshot.revision && resolution.kind === 'resolved') {
    return resolution.session;
  }

  return LOADING_SESSION;
}
