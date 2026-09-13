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

/** Binds one dynamic document-type route to its response contract. */
export function getDocumentTypeEndpoint(
  documentType: string,
): PlatformGetEndpoint<PlatformDocumentTypeResponse> {
  return {
    path: getPlatformDocumentTypeRoute(documentType),
    responseSchema: platformDocumentTypeResponseSchema,
  };
}

/** Binds one dynamic user route to its response contract. */
export function getUserEndpoint(userId: string): PlatformGetEndpoint<PlatformUserResponse> {
  return {
    path: getPlatformUserRoute(userId),
    responseSchema: platformUserResponseSchema,
  };
}
