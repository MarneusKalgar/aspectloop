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
    path: PLATFORM_INTERNAL_ROUTES.documentTypes,
    responseSchema: platformDocumentTypesResponseSchema,
  } satisfies PlatformGetEndpoint<PlatformDocumentTypesResponse>,
  health: {
    path: PLATFORM_INTERNAL_ROUTES.health,
    responseSchema: platformHealthResponseSchema,
  } satisfies PlatformGetEndpoint<PlatformHealthResponse>,
  readiness: {
    path: PLATFORM_INTERNAL_ROUTES.readiness,
    responseSchema: platformReadinessResponseSchema,
  } satisfies PlatformGetEndpoint<PlatformReadinessResponse>,
  signIn: {
    path: PLATFORM_INTERNAL_ROUTES.auth.signIn,
    requestSchema: platformSignInRequestSchema,
    responseSchema: platformSignInResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformSignInRequest, PlatformSignInResponse>,
  signOut: {
    path: PLATFORM_INTERNAL_ROUTES.auth.signOut,
    requestSchema: platformSignOutRequestSchema,
    responseSchema: platformSignOutResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformSignOutRequest, PlatformSignOutResponse>,
  signUp: {
    path: PLATFORM_INTERNAL_ROUTES.auth.signUp,
    requestSchema: platformSignUpRequestSchema,
    responseSchema: platformSignUpResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformSignUpRequest, PlatformSignUpResponse>,
  usersBatch: {
    path: PLATFORM_INTERNAL_ROUTES.users.batch,
    requestSchema: platformUsersBatchRequestSchema,
    responseSchema: platformUsersBatchResponseSchema,
  } satisfies PlatformPostEndpoint<PlatformUsersBatchRequest, PlatformUsersBatchResponse>,
};

/**
 * Binds a caller-supplied document-type key to its validated internal route.
 *
 * @param documentType Platform registry key selected by the gateway resolver.
 * @returns Route and response schema consumed by the internal transport.
 */
export function getDocumentTypeEndpoint(
  documentType: string,
): PlatformGetEndpoint<PlatformDocumentTypeResponse> {
  return {
    path: getPlatformDocumentTypeRoute(documentType),
    responseSchema: platformDocumentTypeResponseSchema,
  };
}

/**
 * Binds a caller-supplied user ID to its validated internal route.
 *
 * @param userId Platform user identifier selected by gateway composition.
 * @returns Route and response schema consumed by the internal transport.
 */
export function getUserEndpoint(userId: string): PlatformGetEndpoint<PlatformUserResponse> {
  return {
    path: getPlatformUserRoute(userId),
    responseSchema: platformUserResponseSchema,
  };
}
