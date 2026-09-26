export const AUTH_LOCK_TIMEOUT_MS = 2000;
export const AUTH_REVOCATION_REASON_MAX_LENGTH = 32;
export const AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_MS = 60_000;

export const AUTH_SESSION_REVOCATION_REASON = Object.freeze({
  LOGOUT: 'logout',
  REFRESH_REUSE: 'refresh_reuse',
} as const);

export type AuthSessionRevocationReason =
  (typeof AUTH_SESSION_REVOCATION_REASON)[keyof typeof AUTH_SESSION_REVOCATION_REASON];
