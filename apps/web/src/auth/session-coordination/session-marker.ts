import { z } from 'zod';

export const SESSION_MARKER_KEY = 'aspectloop.session-coordination.v1';
export const SESSION_COOKIE_LOCK = 'aspectloop.session-cookie.v1';
export const SESSION_MARKER_LOCK = 'aspectloop.session-marker.v1';
export const AUTH_REQUEST_DEADLINE_MS = 10_000;
export const AUTH_LOCK_DEADLINE_MS = 10_000;
const MAX_MARKER_LENGTH = 1024;

const markerSchema = z
  .object({
    action: z
      .object({
        id: z.uuid(),
        kind: z.enum(['sign-in', 'sign-out']),
        status: z.enum(['pending', 'unknown']),
      })
      .strict()
      .nullable(),
    epoch: z.union([z.uuid(), z.literal('initial')]),
    logoutIntent: z.boolean(),
    revocation: z.enum(['none', 'unconfirmed', 'confirmed']),
    version: z.literal(1),
  })
  .strict();

export type SessionActionKind = NonNullable<SessionMarker['action']>['kind'];
export type SessionMarker = z.infer<typeof markerSchema>;

export const INITIAL_SESSION_MARKER: SessionMarker = {
  action: null,
  epoch: 'initial',
  logoutIntent: false,
  revocation: 'none',
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
  if (
    (!marker.logoutIntent && marker.revocation !== 'none') ||
    (marker.logoutIntent && marker.revocation === 'none') ||
    (marker.action?.status === 'unknown' && marker.revocation !== 'unconfirmed')
  ) {
    throw new Error('Session coordination storage is unavailable');
  }

  return marker;
}
