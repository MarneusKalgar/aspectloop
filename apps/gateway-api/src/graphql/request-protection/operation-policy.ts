export const AUTH_RATE_LIMIT_ACTION = Object.freeze({
  CONFIRMATION: 'confirmation',
  REGISTRATION: 'registration',
  SIGN_IN: 'signIn',
} as const);

export type AuthRateLimitAction =
  (typeof AUTH_RATE_LIMIT_ACTION)[keyof typeof AUTH_RATE_LIMIT_ACTION];

export const AUTH_OPERATION_NAME = Object.freeze({
  CONFIRM_EMAIL: 'confirmEmail',
  RESEND_EMAIL_CONFIRMATION: 'resendEmailConfirmation',
  SIGN_IN: 'signIn',
  SIGN_OUT: 'signOut',
  SIGN_UP: 'signUp',
} as const);

export interface OperationProtectionPolicy {
  readonly rateLimit?: AuthRateLimitAction;
  readonly requiresSoleRoot?: true;
}

/** Declares additional request protections owned by public auth operations. */
export const AUTH_OPERATION_POLICIES: Readonly<Record<string, OperationProtectionPolicy>> =
  Object.freeze({
    [AUTH_OPERATION_NAME.CONFIRM_EMAIL]: Object.freeze({
      rateLimit: AUTH_RATE_LIMIT_ACTION.CONFIRMATION,
    }),
    [AUTH_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION]: Object.freeze({
      rateLimit: AUTH_RATE_LIMIT_ACTION.REGISTRATION,
    }),
    [AUTH_OPERATION_NAME.SIGN_IN]: Object.freeze({
      rateLimit: AUTH_RATE_LIMIT_ACTION.SIGN_IN,
      requiresSoleRoot: true,
    }),
    [AUTH_OPERATION_NAME.SIGN_OUT]: Object.freeze({
      requiresSoleRoot: true,
    }),
    [AUTH_OPERATION_NAME.SIGN_UP]: Object.freeze({
      rateLimit: AUTH_RATE_LIMIT_ACTION.REGISTRATION,
    }),
  });

/** Registry consumed by the request boundary; additional feature policies compose here. */
const OPERATION_PROTECTION_POLICIES: Readonly<Record<string, OperationProtectionPolicy>> =
  Object.freeze({
    ...AUTH_OPERATION_POLICIES,
  });

/** Resolves declared metadata without treating inherited object names as operations. */
export function getOperationProtectionPolicy(root: string): null | OperationProtectionPolicy {
  if (!Object.hasOwn(OPERATION_PROTECTION_POLICIES, root)) {
    return null;
  }

  return OPERATION_PROTECTION_POLICIES[root] ?? null;
}
