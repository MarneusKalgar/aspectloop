export const IDENTITY_LIMITS = Object.freeze({
  MAX_KEYS: 10_000,
  REGISTRATION_ATTEMPTS: 3,
  REGISTRATION_WINDOW_MS: 60 * 60 * 1000,
  SIGN_IN_ATTEMPTS: 5,
  SIGN_IN_WINDOW_MS: 15 * 60 * 1000,
});

export const SIGN_IN_CHECK_OUTCOME = Object.freeze({
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  RELEASED: 'released',
} as const);

export type SignInCheckOutcome = (typeof SIGN_IN_CHECK_OUTCOME)[keyof typeof SIGN_IN_CHECK_OUTCOME];
