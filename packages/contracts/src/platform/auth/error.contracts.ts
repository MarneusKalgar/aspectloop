import { z } from 'zod';

import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_CODES,
  AUTH_ERROR_HTTP_STATUS,
  AUTH_ERROR_POLICY,
} from './error.constants';

export const authErrorCodeSchema = z.enum(AUTH_ERROR_CODES);

const platformAuthErrorMessageSchema = z
  .string()
  .min(AUTH_ERROR_POLICY.MESSAGE_MIN_LENGTH)
  .max(AUTH_ERROR_POLICY.MESSAGE_MAX_LENGTH);
const authRetryAfterMsSchema = z
  .number()
  .int()
  .min(AUTH_ERROR_POLICY.RETRY_AFTER_MS_MIN)
  .max(AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX);

export const platformAuthErrorResponseSchema = z.discriminatedUnion('code', [
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.INVALID_CREDENTIALS),
      message: platformAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.INVALID_CREDENTIALS),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.EMAIL_UNVERIFIED),
      message: platformAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.EMAIL_UNVERIFIED),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.SESSION_INVALID),
      message: platformAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.SESSION_INVALID),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.REFRESH_CONFLICT),
      message: platformAuthErrorMessageSchema,
      retryAfterMs: z.literal(AUTH_ERROR_POLICY.REFRESH_CONFLICT_RETRY_AFTER_MS),
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.REFRESH_CONFLICT),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.CONFIRMATION_INVALID),
      message: platformAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.CONFIRMATION_INVALID),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.RATE_LIMITED),
      message: platformAuthErrorMessageSchema,
      retryAfterMs: authRetryAfterMsSchema.optional(),
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.RATE_LIMITED),
    })
    .strict(),
  z
    .object({
      code: z.literal(AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE),
      message: platformAuthErrorMessageSchema,
      statusCode: z.literal(AUTH_ERROR_HTTP_STATUS.DEPENDENCY_UNAVAILABLE),
    })
    .strict(),
]);

export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;
export type PlatformAuthErrorResponse = z.infer<typeof platformAuthErrorResponseSchema>;
