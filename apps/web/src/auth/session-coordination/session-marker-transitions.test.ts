import { describe, expect, it } from 'vitest';

import {
  INITIAL_SESSION_MARKER,
  parseSessionMarker,
  requiresSessionReset,
  type SessionMarker,
} from './session-marker';
import {
  acknowledgeSignIn,
  acknowledgeSignOut,
  beginSignIn,
  beginSignOut,
  failCookieAction,
  orphanPendingAction,
  publishLogoutIntent,
} from './session-marker-transitions';

const id = '00000000-0000-4000-8000-000000000001';
const epoch = '00000000-0000-4000-8000-000000000002';
const peerId = '00000000-0000-4000-8000-000000000003';

describe('pure session marker transitions' /** Preserves ordering decisions without browser locks or network adapters. */, () => {
  it('returns explicit acceptance only for the login owning the current epoch' /** Successful cookie settlement cannot erase a newer logout. */, () => {
    const login = beginSignIn(INITIAL_SESSION_MARKER, id).marker;
    const accepted = acknowledgeSignIn(login, id, epoch);

    expect(accepted.result).toBe(true);
    expect(accepted.marker).toMatchObject({
      action: null,
      logoutIntent: false,
      revocation: 'none',
    });

    const logout = publishLogoutIntent(login, peerId).marker;
    const retired = acknowledgeSignIn(logout, id, epoch);

    expect(retired.result).toBe(false);
    expect(retired.marker).toMatchObject({
      action: { kind: 'sign-out', status: 'ready' },
      logoutIntent: true,
      revocation: 'unconfirmed',
    });
    expect(login.action?.status).toBe('pending');
    expect(login.epoch).toBe(id);
    expect(parseSessionMarker(JSON.stringify(retired.marker))).toEqual(retired.marker);
  });

  it('returns no-op decisions for peer-owned or already acknowledged work' /** Older handlers neither dispatch nor rewrite a newer account marker. */, () => {
    expect(beginSignOut(INITIAL_SESSION_MARKER, id)).toEqual({
      marker: INITIAL_SESSION_MARKER,
      result: false,
    });
    const intent = publishLogoutIntent(INITIAL_SESSION_MARKER, epoch).marker;
    const pending = beginSignOut(intent, id);
    expect(pending.result).toBe(true);
    const confirmed = acknowledgeSignOut(pending.marker, id, epoch).marker;
    expect(beginSignOut(confirmed, peerId).result).toBe(false);
    expect(acknowledgeSignOut(pending.marker, peerId, epoch).marker).toBe(pending.marker);
    expect(acknowledgeSignIn(pending.marker, peerId, epoch).result).toBe(false);
    expect(parseSessionMarker(JSON.stringify(confirmed))).toEqual(confirmed);
  });

  it('distinguishes completed sign-in rejection, outage, and transport uncertainty' /** Failed sign-in does not clear the cookie; only ordered known completion permits logout. */, () => {
    const login = beginSignIn(INITIAL_SESSION_MARKER, id).marker;
    const rejected = failCookieAction(login, id, epoch, {
      completed: true,
      expectedRejection: true,
    }).marker;

    expect(rejected).toMatchObject({ action: null, logoutIntent: false, revocation: 'none' });

    const outage = failCookieAction(login, id, epoch, {
      completed: true,
      expectedRejection: false,
    }).marker;

    expect(outage).toMatchObject({
      action: { kind: 'sign-out', status: 'ready' },
      logoutIntent: true,
      revocation: 'unconfirmed',
    });
    expect(beginSignOut(outage, peerId).result).toBe(true);

    const unknown = failCookieAction(login, id, epoch, {
      completed: false,
      expectedRejection: false,
    }).marker;

    expect(unknown.action?.status).toBe('unknown');
    expect(
      /** Unknown cookie settlement blocks explicit revocation recovery. */
      () => beginSignOut(unknown, peerId),
    ).toThrow(/unresolved/);
    expect(
      /** Unknown cookie settlement cannot grant new login permission. */
      () => beginSignIn(unknown, peerId),
    ).toThrow(/confirmed/);
    expect(parseSessionMarker(JSON.stringify(unknown))).toEqual(unknown);
  });

  it('preserves prior logout intent on expected rejection and ignores non-owning failures' /** Completed rejection cannot clear suppression that another action established. */, () => {
    const login = beginSignIn(INITIAL_SESSION_MARKER, id).marker;
    const intent = publishLogoutIntent(login, peerId).marker;
    const failure = { completed: true, expectedRejection: true };

    expect(failCookieAction(intent, id, epoch, failure).marker).toMatchObject({
      action: { kind: 'sign-out', status: 'ready' },
      logoutIntent: true,
      revocation: 'unconfirmed',
    });
    expect(failCookieAction(intent, peerId, epoch, failure).marker).toBe(intent);
  });

  it('preserves confirmed logout after an expected login rejection' /** Retained confirmed intent is not a new unconfirmed logout requiring a ready action. */, () => {
    const ready = publishLogoutIntent(INITIAL_SESSION_MARKER, epoch).marker;
    const pending = beginSignOut(ready, id).marker;
    const confirmed = acknowledgeSignOut(pending, id, epoch).marker;
    const login = beginSignIn(confirmed, peerId).marker;
    const rejected = failCookieAction(login, peerId, epoch, {
      completed: true,
      expectedRejection: true,
    }).marker;

    expect(rejected).toMatchObject({ action: null, logoutIntent: true, revocation: 'confirmed' });
    expect(parseSessionMarker(JSON.stringify(rejected))).toEqual(rejected);
    expect(requiresSessionReset(rejected)).toBe(false);
    expect(beginSignIn(rejected, id).marker.action?.kind).toBe('sign-in');
  });

  it('makes orphan inspection idempotent and permits login only after confirmed logout' /** Native lock release does not prove the pending server request rolled back. */, () => {
    const login = beginSignIn(INITIAL_SESSION_MARKER, id).marker;
    const unknown = orphanPendingAction(login, epoch).marker;
    expect(unknown).toMatchObject({
      action: { status: 'unknown' },
      logoutIntent: true,
      revocation: 'unconfirmed',
    });
    expect(orphanPendingAction(unknown, peerId).marker).toBe(unknown);
    expect(orphanPendingAction(INITIAL_SESSION_MARKER, epoch).marker).toBe(INITIAL_SESSION_MARKER);
    const intent = publishLogoutIntent(INITIAL_SESSION_MARKER, epoch).marker;
    expect(
      /** Unconfirmed revocation blocks a subsequent login. */
      () => beginSignIn(intent, id),
    ).toThrow(/confirmed/);
    const pending = beginSignOut(intent, id).marker;
    const confirmed = acknowledgeSignOut(pending, id, epoch).marker;
    expect(beginSignIn(confirmed, peerId).marker.action?.kind).toBe('sign-in');
  });

  it('never turns failed logout or legacy ambiguous intent into retry permission' /** Cookie-less acknowledgement cannot settle an earlier lost credential. */, () => {
    const ready = publishLogoutIntent(INITIAL_SESSION_MARKER, epoch).marker;
    const pending = beginSignOut(ready, id).marker;
    const failed = failCookieAction(pending, id, epoch, {
      completed: true,
      expectedRejection: false,
    }).marker;
    const legacy: SessionMarker = { ...failed, action: null };
    const unknown = failCookieAction(pending, id, epoch, {
      completed: false,
      expectedRejection: false,
    }).marker;

    expect(failed.action?.status).toBe('failed');
    expect(requiresSessionReset(ready)).toBe(false);

    for (const blocked of [failed, legacy, unknown]) {
      expect(requiresSessionReset(blocked)).toBe(true);
      expect(parseSessionMarker(JSON.stringify(blocked))).toEqual(blocked);
      expect(publishLogoutIntent(blocked, peerId).marker).toBe(blocked);
      expect(orphanPendingAction(blocked, peerId).marker).toBe(blocked);
      expect(acknowledgeSignOut(blocked, id, peerId).marker).toBe(blocked);

      expect(
        /** Explicit retry must not dispatch after a credential-losing or ambiguous logout. */
        () => beginSignOut(blocked, peerId),
      ).toThrow(/unresolved/);
      expect(
        /** New login cannot replace confirmation of the original session's revocation. */
        () => beginSignIn(blocked, peerId),
      ).toThrow(/confirmed/);
    }
  });

  it('validates ready/failed status against logout intent and revocation state' /** New statuses cannot be reused as sign-in or confirmed action permission. */, () => {
    const ready = publishLogoutIntent(INITIAL_SESSION_MARKER, epoch).marker;

    expect(ready.action).toMatchObject({ kind: 'sign-out', status: 'ready' });
    expect(acknowledgeSignOut(ready, epoch, peerId).marker).toBe(ready);
    expect(acknowledgeSignIn(ready, epoch, peerId).marker).toBe(ready);

    for (const status of ['ready', 'failed'] as const) {
      const action = { id, kind: 'sign-out', status };

      for (const inconsistent of [
        { ...ready, action: { ...action, kind: 'sign-in' } },
        { ...ready, action, logoutIntent: false, revocation: 'none' },
        { ...ready, action, revocation: 'confirmed' },
      ]) {
        expect(
          /** Strict storage rejects status combinations that could erase dispatch provenance. */
          () => parseSessionMarker(JSON.stringify(inconsistent)),
        ).toThrow();
      }
    }
  });
});
