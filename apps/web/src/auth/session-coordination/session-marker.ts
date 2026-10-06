import { z } from 'zod';

export const SESSION_MARKER_KEY = 'aspectloop.session-coordination.v1';
export const SESSION_COOKIE_LOCK = 'aspectloop.session-cookie.v1';
export const SESSION_MARKER_LOCK = 'aspectloop.session-marker.v1';
export const AUTH_REQUEST_DEADLINE_MS = 10_000;
export const AUTH_LOCK_DEADLINE_MS = 10_000;
const MAX_MARKER_LENGTH = 1024;

export const SESSION_ACTION_KIND = Object.freeze({
  SIGN_IN: 'sign-in',
  SIGN_OUT: 'sign-out',
} as const);

export const SESSION_ACTION_STATUS = Object.freeze({
  FAILED: 'failed',
  PENDING: 'pending',
  READY: 'ready',
  UNKNOWN: 'unknown',
} as const);

export const SESSION_REVOCATION = Object.freeze({
  CONFIRMED: 'confirmed',
  NONE: 'none',
  UNCONFIRMED: 'unconfirmed',
} as const);

const markerSchema = z
  .object({
    action: z
      .object({
        id: z.uuid(),
        kind: z.enum(SESSION_ACTION_KIND),
        status: z.enum(SESSION_ACTION_STATUS),
      })
      .strict()
      .nullable(),
    epoch: z.union([z.uuid(), z.literal('initial')]),
    logoutIntent: z.boolean(),
    revocation: z.enum(SESSION_REVOCATION),
    version: z.literal(1),
  })
  .strict();

export type SessionActionKind = NonNullable<SessionMarker['action']>['kind'];
export type SessionMarker = z.infer<typeof markerSchema>;

export const INITIAL_SESSION_MARKER: SessionMarker = {
  action: null,
  epoch: 'initial',
  logoutIntent: false,
  revocation: SESSION_REVOCATION.NONE,
  version: 1,
};

/** Rejects oversized, unknown-version, inconsistent, or secret-bearing marker records. */
export function parseSessionMarker(raw: null | string): SessionMarker {
  if (raw === null) {
    return { ...INITIAL_SESSION_MARKER };
  }

  if (raw.length > MAX_MARKER_LENGTH) {
    throw new Error('Session coordination storage is unavailable');
  }

  const marker = markerSchema.parse(JSON.parse(raw) as unknown);

  assertMarkerConsistency(marker);

  return marker;
}

/** Requires reset for lost logout credentials, uncertain effects, or legacy ambiguous intent. */
export function requiresSessionReset(marker: null | SessionMarker): boolean {
  if (!marker) {
    return true;
  }

  return (
    marker.action?.status === SESSION_ACTION_STATUS.FAILED ||
    marker.action?.status === SESSION_ACTION_STATUS.UNKNOWN ||
    (marker.logoutIntent && marker.revocation === SESSION_REVOCATION.UNCONFIRMED && !marker.action)
  );
}

/** Enforces intent, uncertainty and sign-out-only status invariants after structural parsing. */
function assertMarkerConsistency(marker: SessionMarker): void {
  const hasRevocation = marker.revocation !== SESSION_REVOCATION.NONE;

  if (marker.logoutIntent !== hasRevocation) {
    throw new Error('Session coordination storage is unavailable');
  }

  const { action } = marker;

  if (!action) {
    return;
  }

  if (
    action.status === SESSION_ACTION_STATUS.UNKNOWN &&
    marker.revocation !== SESSION_REVOCATION.UNCONFIRMED
  ) {
    throw new Error('Session coordination storage is unavailable');
  }

  if (
    action.status !== SESSION_ACTION_STATUS.READY &&
    action.status !== SESSION_ACTION_STATUS.FAILED
  ) {
    return;
  }

  if (
    action.kind !== SESSION_ACTION_KIND.SIGN_OUT ||
    !marker.logoutIntent ||
    marker.revocation !== SESSION_REVOCATION.UNCONFIRMED
  ) {
    throw new Error('Session coordination storage is unavailable');
  }
}
