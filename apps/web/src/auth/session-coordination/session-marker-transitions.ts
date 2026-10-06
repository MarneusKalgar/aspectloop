import type { CookieActionFailure } from './cookie-action-request';
import type { SessionMarker } from './session-marker';

import {
  requiresSessionReset,
  SESSION_ACTION_KIND,
  SESSION_ACTION_STATUS,
  SESSION_REVOCATION,
} from './session-marker';

export interface MarkerTransition<T = void> {
  marker: SessionMarker;
  result: T;
}

/** Settles this login while preserving any logout intent that superseded its epoch. */
export function acknowledgeSignIn(
  marker: SessionMarker,
  id: string,
  epoch: string,
): MarkerTransition<boolean> {
  if (
    marker.action?.id !== id ||
    marker.action.kind !== SESSION_ACTION_KIND.SIGN_IN ||
    marker.action.status !== SESSION_ACTION_STATUS.PENDING
  ) {
    return { marker, result: false };
  }

  const accepted = marker.epoch === id;

  return {
    marker: {
      ...marker,
      action: accepted
        ? null
        : { id: epoch, kind: SESSION_ACTION_KIND.SIGN_OUT, status: SESSION_ACTION_STATUS.READY },
      epoch,
      logoutIntent: accepted ? false : marker.logoutIntent,
      revocation: accepted ? SESSION_REVOCATION.NONE : marker.revocation,
    },
    result: accepted,
  };
}

/** Confirms only the owning pending logout, never a failed, unknown or undispatched action. */
export function acknowledgeSignOut(
  marker: SessionMarker,
  id: string,
  epoch: string,
): MarkerTransition {
  if (
    marker.action?.id !== id ||
    marker.action.kind !== SESSION_ACTION_KIND.SIGN_OUT ||
    marker.action.status !== SESSION_ACTION_STATUS.PENDING
  ) {
    return { marker, result: undefined };
  }

  return {
    marker: {
      ...marker,
      action: null,
      epoch,
      logoutIntent: true,
      revocation: SESSION_REVOCATION.CONFIRMED,
    },
    result: undefined,
  };
}

/** Records login only when no earlier action or unconfirmed revocation remains. */
export function beginSignIn(marker: SessionMarker, id: string): MarkerTransition {
  if (
    marker.action ||
    (marker.logoutIntent && marker.revocation !== SESSION_REVOCATION.CONFIRMED)
  ) {
    throw new Error('Sign out must be confirmed before signing in.');
  }

  return {
    marker: {
      ...marker,
      action: { id, kind: SESSION_ACTION_KIND.SIGN_IN, status: SESSION_ACTION_STATUS.PENDING },
      epoch: id,
    },
    result: undefined,
  };
}

/** Decides dispatch atomically; an acknowledged peer logout/new login supersedes old work. */
export function beginSignOut(marker: SessionMarker, id: string): MarkerTransition<boolean> {
  if (!marker.logoutIntent || marker.revocation === SESSION_REVOCATION.CONFIRMED) {
    return { marker, result: false };
  }

  if (
    marker.action?.kind !== SESSION_ACTION_KIND.SIGN_OUT ||
    marker.action.status !== SESSION_ACTION_STATUS.READY
  ) {
    throw new Error('The previous account action is unresolved. Reset the browser session.');
  }

  return {
    marker: {
      ...marker,
      action: { id, kind: SESSION_ACTION_KIND.SIGN_OUT, status: SESSION_ACTION_STATUS.PENDING },
      epoch: id,
    },
    result: true,
  };
}

/** Completed logout failure loses its credential; only completed sign-in permits ordered revocation. */
export function failCookieAction(
  marker: SessionMarker,
  id: string,
  epoch: string,
  failure: CookieActionFailure,
): MarkerTransition {
  if (marker.action?.id !== id || marker.action.status !== SESSION_ACTION_STATUS.PENDING) {
    return { marker, result: undefined };
  }

  let action: SessionMarker['action'];

  if (!failure.completed) {
    action = { ...marker.action, status: SESSION_ACTION_STATUS.UNKNOWN };
  } else if (marker.action.kind === SESSION_ACTION_KIND.SIGN_OUT) {
    action = { ...marker.action, status: SESSION_ACTION_STATUS.FAILED };
  } else if (
    !failure.expectedRejection ||
    (marker.logoutIntent && marker.revocation === SESSION_REVOCATION.UNCONFIRMED)
  ) {
    action = { id: epoch, kind: SESSION_ACTION_KIND.SIGN_OUT, status: SESSION_ACTION_STATUS.READY };
  } else {
    action = null;
  }

  return {
    marker: {
      ...marker,
      action,
      epoch,
      logoutIntent: failure.expectedRejection ? marker.logoutIntent : true,
      revocation: failure.expectedRejection ? marker.revocation : SESSION_REVOCATION.UNCONFIRMED,
    },
    result: undefined,
  };
}

/** Marks an ownerless pending action unknown; time or lock release cannot prove rollback. */
export function orphanPendingAction(marker: SessionMarker, epoch: string): MarkerTransition {
  if (marker.action?.status !== SESSION_ACTION_STATUS.PENDING) {
    return { marker, result: undefined };
  }

  return {
    marker: {
      ...marker,
      action: { ...marker.action, status: SESSION_ACTION_STATUS.UNKNOWN },
      epoch,
      logoutIntent: true,
      revocation: SESSION_REVOCATION.UNCONFIRMED,
    },
    result: undefined,
  };
}

/** Records pre-dispatch intent without laundering failed, unknown or legacy logout state. */
export function publishLogoutIntent(marker: SessionMarker, epoch: string): MarkerTransition {
  if (requiresSessionReset(marker)) {
    return { marker, result: undefined };
  }

  return {
    marker: {
      ...marker,
      action: marker.action ?? {
        id: epoch,
        kind: SESSION_ACTION_KIND.SIGN_OUT,
        status: SESSION_ACTION_STATUS.READY,
      },
      epoch,
      logoutIntent: true,
      revocation: SESSION_REVOCATION.UNCONFIRMED,
    },
    result: undefined,
  };
}
