import type { CookieActionFailure } from './cookie-action-request';
import type { SessionMarker } from './session-marker';

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
  if (marker.action?.id !== id) {
    return { marker, result: false };
  }

  const accepted = marker.epoch === id;
  return {
    marker: {
      ...marker,
      action: null,
      epoch,
      logoutIntent: accepted ? false : marker.logoutIntent,
      revocation: accepted ? 'none' : marker.revocation,
    },
    result: accepted,
  };
}

/** Retains suppression after acknowledged revocation until a new explicit login. */
export function acknowledgeSignOut(
  marker: SessionMarker,
  id: string,
  epoch: string,
): MarkerTransition {
  if (marker.action?.id !== id) {
    return { marker, result: undefined };
  }

  return {
    marker: { ...marker, action: null, epoch, logoutIntent: true, revocation: 'confirmed' },
    result: undefined,
  };
}

/** Records login only when no earlier action or unconfirmed revocation remains. */
export function beginSignIn(marker: SessionMarker, id: string): MarkerTransition {
  if (marker.action || (marker.logoutIntent && marker.revocation !== 'confirmed')) {
    throw new Error('Sign out must be confirmed before signing in.');
  }

  return {
    marker: { ...marker, action: { id, kind: 'sign-in', status: 'pending' }, epoch: id },
    result: undefined,
  };
}

/** Decides dispatch atomically; an acknowledged peer logout/new login supersedes old work. */
export function beginSignOut(marker: SessionMarker, id: string): MarkerTransition<boolean> {
  if (!marker.logoutIntent || marker.revocation === 'confirmed') {
    return { marker, result: false };
  }

  if (marker.action) {
    throw new Error('The previous account action is unresolved. Reset the browser session.');
  }

  return {
    marker: { ...marker, action: { id, kind: 'sign-out', status: 'pending' }, epoch: id },
    result: true,
  };
}

/** Settles only its own action; network uncertainty remains blocked, never assumed rolled back. */
export function failCookieAction(
  marker: SessionMarker,
  id: string,
  epoch: string,
  failure: CookieActionFailure,
): MarkerTransition {
  if (marker.action?.id !== id) {
    return { marker, result: undefined };
  }

  return {
    marker: {
      ...marker,
      action: failure.completed ? null : { ...marker.action, status: 'unknown' },
      epoch,
      logoutIntent: failure.expectedRejection ? marker.logoutIntent : true,
      revocation: failure.expectedRejection ? marker.revocation : 'unconfirmed',
    },
    result: undefined,
  };
}

/** Marks an ownerless pending action unknown; time or lock release cannot prove rollback. */
export function orphanPendingAction(marker: SessionMarker, epoch: string): MarkerTransition {
  if (marker.action?.status !== 'pending') {
    return { marker, result: undefined };
  }

  return {
    marker: {
      ...marker,
      action: { ...marker.action, status: 'unknown' },
      epoch,
      logoutIntent: true,
      revocation: 'unconfirmed',
    },
    result: undefined,
  };
}

/** Publishes suppression without hiding a pending cookie request. */
export function publishLogoutIntent(marker: SessionMarker, epoch: string): MarkerTransition {
  return {
    marker: { ...marker, epoch, logoutIntent: true, revocation: 'unconfirmed' },
    result: undefined,
  };
}
