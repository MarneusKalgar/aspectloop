import type { IncomingMessage, ServerResponse } from 'node:http';

const ANONYMOUS_ROUTE = '<unmatched>';
const MAX_ROUTE_LENGTH = 256;

export interface HttpCompletionLog {
  durationMs: number;
  event: 'http.request.completed';
  method: string;
  outcome: HttpOutcome;
  route: string;
  statusCode: number;
}

type HttpOutcome = 'client_error' | 'server_error' | 'success';

interface RoutableRequest extends IncomingMessage {
  baseUrl?: string;
  route?: {
    path?: unknown;
  };
}

/**
 * Creates the compact failed HTTP completion event without serializing the error.
 *
 * @param request Failed HTTP request.
 * @param response Failed HTTP response.
 * @param error Pino's error object, intentionally ignored to avoid unbounded data.
 * @param loggableObject Pino's default response/error object, used only for duration.
 * @returns A bounded completion event without request, response, or error objects.
 */
export function createHttpErrorObject(
  request: IncomingMessage,
  response: ServerResponse,
  error: Error,
  loggableObject: unknown,
): HttpCompletionLog {
  void error;

  return createHttpCompletionLog(request, response, getResponseTime(loggableObject));
}

/**
 * Creates the compact successful HTTP completion event.
 *
 * @param request Completed HTTP request.
 * @param response Completed HTTP response.
 * @param loggableObject Pino's default response object, used only for duration.
 * @returns A bounded completion event without request or response objects.
 */
export function createHttpSuccessObject(
  request: IncomingMessage,
  response: ServerResponse,
  loggableObject: unknown,
): HttpCompletionLog {
  return createHttpCompletionLog(request, response, getResponseTime(loggableObject));
}

/**
 * Returns the static message used for every HTTP completion event.
 *
 * @returns The stable HTTP completion event name.
 */
export function getHttpCompletionMessage(): string {
  return 'http.request.completed';
}

/**
 * Maps HTTP status and runtime errors to consistent Pino levels.
 *
 * @param request Completed request, unused because severity is response-based.
 * @param response Completed response.
 * @param error Optional runtime error reported by pino-http.
 * @returns Error for server failures, warn for client failures, otherwise info.
 */
export function getHttpLogLevel(
  request: IncomingMessage,
  response: ServerResponse,
  error?: Error,
): 'error' | 'info' | 'warn' {
  void request;

  if (error || response.statusCode >= 500) {
    return 'error';
  }

  if (response.statusCode >= 400) {
    return 'warn';
  }

  return 'info';
}

/**
 * Builds one compact event shared by successful and failed response paths.
 *
 * @param request Completed HTTP request.
 * @param response Completed HTTP response.
 * @param responseTime Measured request duration in milliseconds.
 * @returns The stable HTTP completion contract.
 */
function createHttpCompletionLog(
  request: IncomingMessage,
  response: ServerResponse,
  responseTime: number,
): HttpCompletionLog {
  return {
    durationMs: Math.max(0, Math.round(responseTime)),
    event: 'http.request.completed',
    method: normalizeMethod(request.method),
    outcome: getHttpOutcome(response.statusCode),
    route: normalizeRoute(request),
    statusCode: response.statusCode,
  };
}

/**
 * Maps a status code to the bounded HTTP outcome vocabulary.
 *
 * @param statusCode Completed response status code.
 * @returns A success, client-error, or server-error outcome.
 */
function getHttpOutcome(statusCode: number): HttpOutcome {
  if (statusCode >= 500) {
    return 'server_error';
  }

  if (statusCode >= 400) {
    return 'client_error';
  }

  return 'success';
}

/**
 * Extracts Pino's measured response time without retaining its default objects.
 *
 * @param loggableObject Pino's default completion object.
 * @returns A finite, non-negative duration or zero when unavailable.
 */
function getResponseTime(loggableObject: unknown): number {
  if (!isRecord(loggableObject)) {
    return 0;
  }

  const responseTime = loggableObject.responseTime;

  return typeof responseTime === 'number' && Number.isFinite(responseTime) ? responseTime : 0;
}

/**
 * Narrows an unknown value to an object-like record.
 *
 * @param value Value to inspect.
 * @returns Whether the value is a non-null object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Normalizes an HTTP method into a bounded uppercase value.
 *
 * @param method Incoming request method.
 * @returns The normalized method or a stable unknown placeholder.
 */
function normalizeMethod(method: string | undefined): string {
  if (!method || !/^[A-Za-z]{1,16}$/.test(method)) {
    return '<unknown>';
  }

  return method.toUpperCase();
}

/**
 * Produces a route template without query strings or caller-controlled unmatched paths.
 *
 * @param request Completed Express-compatible request.
 * @returns A bounded route template or a stable unmatched placeholder.
 */
function normalizeRoute(request: IncomingMessage): string {
  const routableRequest = request as RoutableRequest;
  const routePath = routableRequest.route?.path;

  if (typeof routePath !== 'string') {
    return ANONYMOUS_ROUTE;
  }

  const route = `${routableRequest.baseUrl ?? ''}${routePath}`;

  return route.length <= MAX_ROUTE_LENGTH ? route : `${route.slice(0, MAX_ROUTE_LENGTH - 3)}...`;
}
