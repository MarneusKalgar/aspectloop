import { z } from 'zod';

import { AUTH_ERROR_CODE, AUTH_ERROR_HTTP_STATUS, AUTH_ERROR_POLICY } from './error.constants';

/** Final Platform auth vocabulary for the opaque browser-session flow. */
export const BROWSER_SESSION_AUTH_ERROR_CODES = Object.freeze([
  AUTH_ERROR_CODE.INVALID_CREDENTIALS,
  AUTH_ERROR_CODE.EMAIL_UNVERIFIED,
  AUTH_ERROR_CODE.SESSION_INVALID,
  AUTH_ERROR_CODE.CONFIRMATION_INVALID,
  AUTH_ERROR_CODE.RATE_LIMITED,
  AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE,
] as const);

export const browserSessionAuthErrorCodeSchema = z.enum(BROWSER_SESSION_AUTH_ERROR_CODES);

const browserSessionAuthErrorMessageSchema = z
  .string()
  .min(AUTH_ERROR_POLICY.MESSAGE_MIN_LENGTH)
  .max(AUTH_ERROR_POLICY.MESSAGE_MAX_LENGTH);
const browserSessionAuthRetryAfterMsSchema = z
  .number()
  .int()
  .min(AUTH_ERROR_POLICY.RETRY_AFTER_MS_MIN)
  .max(AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX);

/** Safe error envelopes accepted from the target Platform auth boundary. */
export const platformBrowserSessionAuthErrorResponseSchema = z.discriminatedUnion('code', [
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.INVALID_CREDENTIALS),
      message: browserSessionAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.INVALID_CREDENTIALS),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.EMAIL_UNVERIFIED),
      message: browserSessionAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.EMAIL_UNVERIFIED),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.SESSION_INVALID),
      message: browserSessionAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.SESSION_INVALID),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.CONFIRMATION_INVALID),
      message: browserSessionAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.CONFIRMATION_INVALID),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.RATE_LIMITED),
      message: browserSessionAuthErrorMessageSchema,
      retryAfterMs: browserSessionAuthRetryAfterMsSchema.optional(),
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.RATE_LIMITED),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE),
      message: browserSessionAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.DEPENDENCY_UNAVAILABLE),
    })
    .strict(),
]);

export type BrowserSessionAuthErrorCode = z.infer<typeof browserSessionAuthErrorCodeSchema>;
export type PlatformBrowserSessionAuthErrorResponse = z.infer<
  typeof platformBrowserSessionAuthErrorResponseSchema
>;
