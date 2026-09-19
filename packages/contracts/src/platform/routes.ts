export const PLATFORM_INTERNAL_API_PREFIX = '/internal/v1';

export const PLATFORM_INTERNAL_ROUTES = Object.freeze({
  auth: Object.freeze({
    confirmEmail: `${PLATFORM_INTERNAL_API_PREFIX}/auth/confirm-email`,
    me: `${PLATFORM_INTERNAL_API_PREFIX}/auth/me`,
    refreshSession: `${PLATFORM_INTERNAL_API_PREFIX}/auth/refresh`,
    resendEmailConfirmation: `${PLATFORM_INTERNAL_API_PREFIX}/auth/resend-email-confirmation`,
    signIn: `${PLATFORM_INTERNAL_API_PREFIX}/auth/sign-in`,
    signOut: `${PLATFORM_INTERNAL_API_PREFIX}/auth/sign-out`,
    signUp: `${PLATFORM_INTERNAL_API_PREFIX}/auth/sign-up`,
  }),
  documentTypes: `${PLATFORM_INTERNAL_API_PREFIX}/document-types`,
  health: `${PLATFORM_INTERNAL_API_PREFIX}/health`,
  readiness: `${PLATFORM_INTERNAL_API_PREFIX}/readiness`,
  users: Object.freeze({
    batch: `${PLATFORM_INTERNAL_API_PREFIX}/users/batch`,
  }),
});

/** Builds the encoded internal route for one document-type configuration. */
export function getPlatformDocumentTypeRoute(documentType: string): string {
  return `${PLATFORM_INTERNAL_ROUTES.documentTypes}/${encodeURIComponent(documentType)}`;
}

/** Builds the encoded internal route for one Platform user view. */
export function getPlatformUserRoute(userId: string): string {
  return `${PLATFORM_INTERNAL_API_PREFIX}/users/${encodeURIComponent(userId)}`;
}
