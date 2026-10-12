import type {
  PlatformConfirmEmailRequest,
  PlatformConfirmEmailResponse,
  PlatformDocumentTypeResponse,
  PlatformDocumentTypesResponse,
  PlatformHealthResponse,
  PlatformReadinessResponse,
  PlatformResendEmailConfirmationRequest,
  PlatformResendEmailConfirmationResponse,
  PlatformSignUpRequest,
  PlatformSignUpResponse,
  PlatformUserResponse,
  PlatformUsersBatchRequest,
  PlatformUsersBatchResponse,
} from '@aspectloop/contracts/platform';

import { Injectable } from '@nestjs/common';

import type { PlatformRequestContext } from './platform-http-transport';

import { getDocumentTypeEndpoint, getUserEndpoint, PLATFORM_ENDPOINTS } from './platform-endpoints';
import { PlatformHttpTransport } from './platform-http-transport';

export type { PlatformRequestContext } from './platform-http-transport';

/**
 * Gateway-facing Platform facade.
 *
 * Callers use domain operations and an optional request context; this class
 * deliberately hides route selection, schemas, serialization, and transport
 * failure mapping in {@link PlatformHttpTransport}.
 */
@Injectable()
export class PlatformClient {
  /** Creates the Platform facade over its internal HTTP transport. */
  constructor(private readonly transport: PlatformHttpTransport) {}

  /** Consumes an explicit confirmation token without any Gateway cookie effects. */
  async confirmEmail(
    input: PlatformConfirmEmailRequest,
    context: PlatformRequestContext = {},
  ): Promise<PlatformConfirmEmailResponse> {
    return this.transport.post(PLATFORM_ENDPOINTS.confirmEmail, input, context);
  }

  /** Reads one Platform-owned document-type configuration. */
  async getDocumentType(
    documentType: string,
    context: PlatformRequestContext = {},
  ): Promise<PlatformDocumentTypeResponse> {
    return this.transport.get(getDocumentTypeEndpoint(documentType), context);
  }

  /** Reads Platform process liveness through the versioned internal boundary. */
  async getHealth(context: PlatformRequestContext = {}): Promise<PlatformHealthResponse> {
    return this.transport.get(PLATFORM_ENDPOINTS.health, context);
  }

  /** Reads Platform dependency readiness through the versioned internal boundary. */
  async getReadiness(context: PlatformRequestContext = {}): Promise<PlatformReadinessResponse> {
    return this.transport.get(PLATFORM_ENDPOINTS.readiness, context);
  }

  /** Reads one Platform-owned user view. */
  async getUser(
    userId: string,
    context: PlatformRequestContext = {},
  ): Promise<PlatformUserResponse> {
    return this.transport.get(getUserEndpoint(userId), context);
  }

  /** Resolves multiple Platform-owned user views through one bounded request. */
  async getUsers(
    input: PlatformUsersBatchRequest,
    context: PlatformRequestContext = {},
  ): Promise<PlatformUsersBatchResponse> {
    return this.transport.post(PLATFORM_ENDPOINTS.usersBatch, input, context);
  }

  /** Reads the complete Platform-owned document-type registry. */
  async listDocumentTypes(
    context: PlatformRequestContext = {},
  ): Promise<PlatformDocumentTypesResponse> {
    return this.transport.get(PLATFORM_ENDPOINTS.documentTypes, context);
  }

  /** Requests confirmation mail through the generic bounded registration contract. */
  async resendEmailConfirmation(
    input: PlatformResendEmailConfirmationRequest,
    context: PlatformRequestContext = {},
  ): Promise<PlatformResendEmailConfirmationResponse> {
    return this.transport.post(PLATFORM_ENDPOINTS.resendEmailConfirmation, input, context);
  }

  /** Requests registration using a strict generic response without identity disclosure. */
  async signUp(
    input: PlatformSignUpRequest,
    context: PlatformRequestContext = {},
  ): Promise<PlatformSignUpResponse> {
    return this.transport.post(PLATFORM_ENDPOINTS.signUp, input, context);
  }
}
