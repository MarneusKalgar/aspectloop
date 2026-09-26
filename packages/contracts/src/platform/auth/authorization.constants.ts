export const PLATFORM_AUTH_ROLE = Object.freeze({
  CORRECTOR: 'CORRECTOR',
} as const);

export const PLATFORM_AUTH_SCOPE = Object.freeze({
  CORRECTIONS_WRITE: 'corrections:write',
} as const);

export const PLATFORM_AUTH_ROLES = Object.freeze([PLATFORM_AUTH_ROLE.CORRECTOR] as const);
export const PLATFORM_AUTH_SCOPES = Object.freeze([PLATFORM_AUTH_SCOPE.CORRECTIONS_WRITE] as const);

export type PlatformAuthRole = (typeof PLATFORM_AUTH_ROLE)[keyof typeof PLATFORM_AUTH_ROLE];
export type PlatformAuthScope = (typeof PLATFORM_AUTH_SCOPE)[keyof typeof PLATFORM_AUTH_SCOPE];
