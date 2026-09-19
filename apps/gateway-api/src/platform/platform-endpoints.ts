import type {
  PlatformDocumentTypeResponse,
  PlatformDocumentTypesResponse,
  PlatformHealthResponse,
  PlatformReadinessResponse,
  PlatformSignInRequest,
  PlatformSignInResponse,
  PlatformSignOutRequest,
  PlatformSignOutResponse,
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
  platformDocumentTypeResponseSchema,
  platformDocumentTypesResponseSchema,
  platformHealthResponseSchema,
  platformReadinessResponseSchema,
  platformSignInRequestSchema,
  platformSignInResponseSchema,
  platformSignOutRequestSchema,
  platformSignOutResponseSchema,
  platformSignUpRequestSchema,
  platformSignUpResponseSchema,
  platformUserResponseSchema,
  platformUsersBatchRequestSchema,
  platformUsersBatchResponseSchema,
} from '@aspectloop/contracts/platform';

import type { PlatformGetEndpoint, PlatformPostEndpoint } from './platform-http-transport';

/** Static Platform route bindings; dynamic identity routes use the helpers below. */
export const PLATFORM_ENDPOINTS = {
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
  signIn: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.signIn,
    path: PLATFORM_INTERNAL_ROUTES.auth.signIn,
    requestSchema: platformSignInRequestSchema,
    responseSchema: platformSignInResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformSignInRequest, PlatformSignInResponse>,
  signOut: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.signOut,
    path: PLATFORM_INTERNAL_ROUTES.auth.signOut,
    requestSchema: platformSignOutRequestSchema,
    responseSchema: platformSignOutResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformSignOutRequest, PlatformSignOutResponse>,
  signUp: {
    logRoute: PLATFORM_INTERNAL_ROUTES.auth.signUp,
    path: PLATFORM_INTERNAL_ROUTES.auth.signUp,
    requestSchema: platformSignUpRequestSchema,
    responseSchema: platformSignUpResponseSchema,
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
