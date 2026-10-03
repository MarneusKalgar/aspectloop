import type { OperationPolicy } from './operation-policy';

export const AUTH_RATE_LIMIT_GROUP = Object.freeze({
  CONFIRMATION: 'confirmation',
  REGISTRATION: 'registration',
  SIGN_IN: 'signIn',
} as const);

export type AuthRateLimitGroup = (typeof AUTH_RATE_LIMIT_GROUP)[keyof typeof AUTH_RATE_LIMIT_GROUP];

export interface AuthRateLimitPolicy {
  readonly attempts: number;
  readonly group: AuthRateLimitGroup;
  readonly windowMs: number;
}

const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const CONFIRMATION_WINDOW_MS = 60 * 1000;

export const AUTH_RATE_LIMIT_POLICIES = Object.freeze({
  CONFIRMATION: Object.freeze({
    attempts: 10,
    group: AUTH_RATE_LIMIT_GROUP.CONFIRMATION,
    windowMs: CONFIRMATION_WINDOW_MS,
  }),
  REGISTRATION: Object.freeze({
    attempts: 20,
    group: AUTH_RATE_LIMIT_GROUP.REGISTRATION,
    windowMs: REGISTRATION_WINDOW_MS,
  }),
  SIGN_IN: Object.freeze({
    attempts: 30,
    group: AUTH_RATE_LIMIT_GROUP.SIGN_IN,
    windowMs: SIGN_IN_WINDOW_MS,
  }),
} as const satisfies Record<string, AuthRateLimitPolicy>);

export const AUTH_OPERATION_NAME = Object.freeze({
  CONFIRM_EMAIL: 'confirmEmail',
  RESEND_EMAIL_CONFIRMATION: 'resendEmailConfirmation',
  SIGN_IN: 'signIn',
  SIGN_OUT: 'signOut',
  SIGN_UP: 'signUp',
} as const);

/** Declares additional request protections owned by public auth operations. */
export const AUTH_OPERATION_POLICIES: Readonly<Record<string, OperationPolicy>> = Object.freeze({
  [AUTH_OPERATION_NAME.CONFIRM_EMAIL]: Object.freeze({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.CONFIRMATION,
  }),
  [AUTH_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION]: Object.freeze({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.REGISTRATION,
  }),
  [AUTH_OPERATION_NAME.SIGN_IN]: Object.freeze({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.SIGN_IN,
    requiresSoleRoot: true,
  }),
  [AUTH_OPERATION_NAME.SIGN_OUT]: Object.freeze({
    requiresSoleRoot: true,
  }),
  [AUTH_OPERATION_NAME.SIGN_UP]: Object.freeze({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.REGISTRATION,
  }),
});
