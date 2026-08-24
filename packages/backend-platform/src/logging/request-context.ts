import type { IncomingMessage, ServerResponse } from 'node:http';

import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

interface OriginalUrlRequest extends IncomingMessage {
  originalUrl?: string;
}

/**
 * Accepts a safe caller request ID or generates a UUID and returns it to the caller.
 *
 * @param request Incoming HTTP request.
 * @param response Outgoing HTTP response.
 * @returns A bounded request identifier safe for logs and response headers.
 */
export function createRequestId(request: IncomingMessage, response: ServerResponse): string {
  const headerValue = request.headers['x-request-id'];
  const candidate = Array.isArray(headerValue) ? undefined : headerValue;
  const requestId = candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();

  response.setHeader('x-request-id', requestId);

  return requestId;
}

/**
 * Detects the routine health endpoint so automatic request logging can suppress it.
 *
 * @param request Incoming HTTP request.
 * @returns Whether the URL pathname is exactly the health endpoint.
 */
export function isHealthRequest(request: IncomingMessage): boolean {
  const originalUrl = (request as OriginalUrlRequest).originalUrl;
  const pathname = getPathname(originalUrl ?? request.url);

  return pathname === '/health' || pathname === '/health/';
}

/**
 * Parses only the pathname required by health-log suppression.
 *
 * @param url Incoming request URL.
 * @returns The parsed pathname or an empty string for malformed input.
 */
function getPathname(url: string | undefined): string {
  if (!url) {
    return '';
  }

  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '';
  }
}
