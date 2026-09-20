export const AUTH_DIGEST_HEX_LENGTH = 64;
export const AUTH_JWT_AUTHORIZATION_VALUE_MAX_LENGTH = 128;
export const AUTH_JWT_AUTHORIZATION_VALUES_MAX = 32;
export const AUTH_LOCK_TIMEOUT_MS = 2000;
export const AUTH_OPAQUE_SECRET_BYTES = 32;
export const AUTH_REVOCATION_REASON_MAX_LENGTH = 32;
export const AUTH_JWT_AUTHORIZATION_VALUE_PATTERN = /^[A-Za-z0-9:._-]+$/;

export const AUTH_SESSION_REVOCATION_REASON = Object.freeze({
  LOGOUT: 'logout',
  REFRESH_REUSE: 'refresh_reuse',
} as const);

export type AuthSessionRevocationReason =
  (typeof AUTH_SESSION_REVOCATION_REASON)[keyof typeof AUTH_SESSION_REVOCATION_REASON];
