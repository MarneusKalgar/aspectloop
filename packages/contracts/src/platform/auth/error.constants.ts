/** Stable machine-readable auth error codes shared across service boundaries. */
export const AUTH_ERROR_CODE = Object.freeze({
  CONFIRMATION_INVALID: 'AUTH_CONFIRMATION_INVALID',
  DEPENDENCY_UNAVAILABLE: 'AUTH_DEPENDENCY_UNAVAILABLE',
  EMAIL_UNVERIFIED: 'AUTH_EMAIL_UNVERIFIED',
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  RATE_LIMITED: 'AUTH_RATE_LIMITED',
  SESSION_INVALID: 'AUTH_SESSION_INVALID',
} as const);

/** Fixed HTTP statuses for safe Platform auth errors. */
export const AUTH_ERROR_HTTP_STATUS = Object.freeze({
  CONFIRMATION_INVALID: 400,
  DEPENDENCY_UNAVAILABLE: 503,
  EMAIL_UNVERIFIED: 403,
  INVALID_CREDENTIALS: 401,
  RATE_LIMITED: 429,
  SESSION_INVALID: 401,
} as const);

/** Bounds and retry behavior that form part of the public auth error contract. */
export const AUTH_ERROR_POLICY = Object.freeze({
  MESSAGE_MAX_LENGTH: 256,
  MESSAGE_MIN_LENGTH: 1,
  RETRY_AFTER_MS_MAX: 60 * 60 * 1000,
  RETRY_AFTER_MS_MIN: 1,
} as const);
