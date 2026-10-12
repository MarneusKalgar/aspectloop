import type {
  PlatformBrowserSessionSignInResponse,
  PlatformBrowserSessionSignOutRequest,
  PlatformBrowserSessionSignOutResponse,
  PlatformBrowserSessionValidationRequest,
  PlatformBrowserSessionValidationResponse,
  PlatformConfirmEmailRequest,
  PlatformConfirmEmailResponse,
  PlatformDocumentTypeResponse,
  PlatformDocumentTypesResponse,
  PlatformHealthResponse,
  PlatformReadinessResponse,
  PlatformResendEmailConfirmationRequest,
  PlatformResendEmailConfirmationResponse,
  PlatformSignInRequest,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
  PlatformUserResponse,
  PlatformUsersBatchRequest,
  PlatformUsersBatchResponse,
} from '@aspectloop/contracts/platform';

import {
  getPlatformDocumentTypeRoute,
  getPlatformUserRoute,
  PLATFORM_INTERNAL_API_PREFIX,
  PLATFORM_INTERNAL_ROUTES,
  platformBrowserSessionSignInResponseSchema,
  platformBrowserSessionSignOutRequestSchema,
  platformBrowserSessionSignOutResponseSchema,
  platformBrowserSessionValidationRequestSchema,
  platformBrowserSessionValidationResponseSchema,
  platformConfirmEmailRequestSchema,
  platformConfirmEmailResponseSchema,
  platformDocumentTypeResponseSchema,
  platformDocumentTypesResponseSchema,
  platformHealthResponseSchema,
  platformPendingSignUpResponseSchema,
  platformReadinessResponseSchema,
  platformResendEmailConfirmationRequestSchema,
  platformResendEmailConfirmationResponseSchema,
  platformSignInRequestSchema,
  platformSignUpRequestSchema,
  platformUserResponseSchema,
  platformUsersBatchRequestSchema,
  platformUsersBatchResponseSchema,
} from '@aspectloop/contracts/platform';

import type { PlatformGetEndpoint, PlatformPostEndpoint } from './platform-http-transport';

import { BROWSER_SESSION_RESPONSE_POLICY } from './platform-response-policy';

/** Static Platform route bindings; dynamic identity routes use the helpers below. */
export const PLATFORM_ENDPOINTS = {
  browserSessionSignIn: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.signIn,
    path: PLATFORM_INTERNAL_ROUTES.auth.signIn,
    requestSchema: platformSignInRequestSchema,
    responsePolicy: BROWSER_SESSION_RESPONSE_POLICY,
    responseSchema: platformBrowserSessionSignInResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformSignInRequest, PlatformBrowserSessionSignInResponse>,
  browserSessionSignOut: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.signOut,
    path: PLATFORM_INTERNAL_ROUTES.auth.signOut,
    requestSchema: platformBrowserSessionSignOutRequestSchema,
    responsePolicy: BROWSER_SESSION_RESPONSE_POLICY,
    responseSchema: platformBrowserSessionSignOutResponseSchema,
  } satisfies PlatformPostEndpoint<
    PlatformBrowserSessionSignOutRequest,
    PlatformBrowserSessionSignOutResponse
  >,
  browserSessionValidate: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.validateSession,
    path: PLATFORM_INTERNAL_ROUTES.auth.validateSession,
    requestSchema: platformBrowserSessionValidationRequestSchema,
    responsePolicy: BROWSER_SESSION_RESPONSE_POLICY,
    responseSchema: platformBrowserSessionValidationResponseSchema,
  } satisfies PlatformPostEndpoint<
    PlatformBrowserSessionValidationRequest,
    PlatformBrowserSessionValidationResponse
  >,
  confirmEmail: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.confirmEmail,
    path: PLATFORM_INTERNAL_ROUTES.auth.confirmEmail,
    requestSchema: platformConfirmEmailRequestSchema,
    responsePolicy: BROWSER_SESSION_RESPONSE_POLICY,
    responseSchema: platformConfirmEmailResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformConfirmEmailRequest, PlatformConfirmEmailResponse>,
  documentTypes: {
    logRoute: PLATFORM_INTERNAL_ROUTES.documentTypes,
    path: PLATFORM_INTERNAL_ROUTES.documentTypes,
    responseSchema: platformDocumentTypesResponseSchema,
  } satisfies PlatformGetEndpoint<PlatformDocumentTypesResponse>,
  health: {
    logRoute: PLATFORM_INTERNAL_ROUTES.health,
    path: PLATFORM_INTERNAL_ROUTES.health,
    responseSchema: platformHealthResponseSchema,
  } satisfies PlatformGetEndpoint<PlatformHealthResponse>,
  readiness: {
    logRoute: PLATFORM_INTERNAL_ROUTES.readiness,
    path: PLATFORM_INTERNAL_ROUTES.readiness,
    responseSchema: platformReadinessResponseSchema,
  } satisfies PlatformGetEndpoint<PlatformReadinessResponse>,
  resendEmailConfirmation: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.resendEmailConfirmation,
    path: PLATFORM_INTERNAL_ROUTES.auth.resendEmailConfirmation,
    requestSchema: platformResendEmailConfirmationRequestSchema,
    responsePolicy: BROWSER_SESSION_RESPONSE_POLICY,
    responseSchema: platformResendEmailConfirmationResponseSchema,
  } satisfies PlatformPostEndpoint<
    PlatformResendEmailConfirmationRequest,
    PlatformResendEmailConfirmationResponse
  >,
  signUp: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.signUp,
    path: PLATFORM_INTERNAL_ROUTES.auth.signUp,
    requestSchema: platformSignUpRequestSchema,
    responsePolicy: BROWSER_SESSION_RESPONSE_POLICY,
    responseSchema: platformPendingSignUpResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformSignUpRequest, PlatformSignUpResponse>,
  usersBatch: {
    logRoute: PLATFORM_INTERNAL_ROUTES.users.batch,
    path: PLATFORM_INTERNAL_ROUTES.users.batch,
    requestSchema: platformUsersBatchRequestSchema,
    responseSchema: platformUsersBatchResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformUsersBatchRequest, PlatformUsersBatchResponse>,
};

/**
 * Binds a caller-supplied document-type key to its validated internal route.
 *
 * @param documentType Platform registry key selected by the gateway resolver.
 * @returns Encoded route, fixed log template, and response schema for the transport.
 */
export function getDocumentTypeEndpoint(
  documentType: string,
): PlatformGetEndpoint<PlatformDocumentTypeResponse> {
  return {
    logRoute: `${PLATFORM_INTERNAL_ROUTES.documentTypes}/:documentType`,
    path: getPlatformDocumentTypeRoute(documentType),
    responseSchema: platformDocumentTypeResponseSchema,
  };
}

/**
 * Binds a caller-supplied user ID to its validated internal route.
 *
 * @param userId Platform user identifier selected by gateway composition.
 * @returns Encoded route, fixed log template, and response schema for the transport.
 */
export function getUserEndpoint(userId: string): PlatformGetEndpoint<PlatformUserResponse> {
  return {
    logRoute: `${PLATFORM_INTERNAL_API_PREFIX}/users/:userId`,
    path: getPlatformUserRoute(userId),
    responseSchema: platformUserResponseSchema,
  };
}
