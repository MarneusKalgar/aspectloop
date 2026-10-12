import {
  platformBrowserSessionAuthErrorResponseSchema,
  platformErrorResponseSchema,
} from '@aspectloop/contracts/platform';

import {
  PlatformBrowserSessionRejectedException,
  PlatformInvalidResponseException,
  PlatformRejectedRequestException,
  PlatformRequestFailedException,
  PlatformUnavailableException,
} from './platform.errors';

/** Endpoint-owned interpretation of bounded Platform response failures. */
export interface PlatformResponsePolicy {
  invalidSuccessResponse(): Error;
  mapRejectedResponse(status: number, body: RejectedResponseBody): Error;
  readsRejectedBody(status: number): boolean;
}

/** Result of one bounded attempt to read a rejected Platform response. */
export type RejectedResponseBody =
  { readonly readable: false } | { readonly readable: true; readonly value: unknown };

const FORWARDABLE_PLATFORM_STATUSES = new Set([400, 401, 403, 404, 409]);

/** Retains the existing Platform domain-rejection behavior for active endpoints. */
export const DEFAULT_PLATFORM_RESPONSE_POLICY: PlatformResponsePolicy = Object.freeze({
  /** Keeps invalid successful responses distinct from failed HTTP statuses. */
  invalidSuccessResponse(): Error {
    return new PlatformInvalidResponseException();
  },

  /** Forwards only validated legacy domain errors. */
  mapRejectedResponse(status: number, body: RejectedResponseBody): Error {
    if (!FORWARDABLE_PLATFORM_STATUSES.has(status) || !body.readable) {
      return new PlatformRequestFailedException(status);
    }

    const parsed = platformErrorResponseSchema.safeParse(body.value);

    if (!parsed.success || parsed.data.statusCode !== status) {
      return new PlatformRequestFailedException(status);
    }

    const message = Array.isArray(parsed.data.message)
      ? parsed.data.message.join(', ')
      : parsed.data.message;

    return new PlatformRejectedRequestException(message, status);
  },

  /** Avoids reading unsupported legacy error bodies, as before. */
  readsRejectedBody(status: number): boolean {
    return FORWARDABLE_PLATFORM_STATUSES.has(status);
  },
});

/** Applies the shared six-code auth contract to session and registration endpoints only. */
export const BROWSER_SESSION_RESPONSE_POLICY: PlatformResponsePolicy = Object.freeze({
  /** A malformed success cannot authenticate a browser request. */
  invalidSuccessResponse(): Error {
    return new PlatformUnavailableException();
  },

  /** Preserves only validated session rejections and their bounded retry. */
  mapRejectedResponse(status: number, body: RejectedResponseBody): Error {
    if (!body.readable) {
      return new PlatformUnavailableException();
    }

    const parsed = platformBrowserSessionAuthErrorResponseSchema.safeParse(body.value);

    if (!parsed.success || parsed.data.statusCode !== status) {
      return new PlatformUnavailableException();
    }

    return new PlatformBrowserSessionRejectedException(
      parsed.data.code,
      parsed.data.message,
      status,
      'retryAfterMs' in parsed.data ? parsed.data.retryAfterMs : undefined,
    );
  },

  /** Every target-session rejection must prove its code/status pairing. */
  readsRejectedBody(): boolean {
    return true;
  },
});
