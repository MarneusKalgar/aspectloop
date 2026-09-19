import { z } from 'zod';

import { platformUserViewSchema } from '../users.contracts';

export const PLATFORM_ACCESS_TOKEN_MAX_LENGTH = 8192;
export const PLATFORM_REFRESH_TOKEN_MAX_LENGTH = 128;

export const platformRefreshTokenSchema = z.string().min(1).max(PLATFORM_REFRESH_TOKEN_MAX_LENGTH);

export const platformSignInRequestSchema = z
  .object({
    email: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const platformSignInResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    user: platformUserViewSchema,
  })
  .strict();

export const platformSignOutRequestSchema = z
  .object({
    userId: z.uuid(),
  })
  .strict();

export const platformSignOutResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

/**
 * M04.2 session-bearing result returned only across the private
 * Gateway-to-Platform boundary.
 * Gateway must explicitly project this shape before returning a public GraphQL
 * payload.
 */
export const platformAuthSessionSchema = z
  .object({
    accessToken: z.string().min(1).max(PLATFORM_ACCESS_TOKEN_MAX_LENGTH),
    refreshExpiresAt: z.iso.datetime({ offset: true }),
    refreshToken: platformRefreshTokenSchema,
    user: platformUserViewSchema,
  })
  .strict();

export const platformSessionSignInResponseSchema = platformAuthSessionSchema;

export const platformRefreshSessionRequestSchema = z
  .object({
    refreshToken: platformRefreshTokenSchema,
  })
  .strict();

export const platformRefreshSessionResponseSchema = platformAuthSessionSchema;

export const platformSessionSignOutRequestSchema = z
  .object({
    refreshToken: platformRefreshTokenSchema,
  })
  .strict();

export const platformMeRequestSchema = z
  .object({
    sessionId: z.uuid(),
    userId: z.uuid(),
  })
  .strict();

export const platformMeResponseSchema = z
  .object({
    user: platformUserViewSchema,
  })
  .strict();

export type PlatformAuthSession = z.infer<typeof platformAuthSessionSchema>;
export type PlatformMeRequest = z.infer<typeof platformMeRequestSchema>;
export type PlatformMeResponse = z.infer<typeof platformMeResponseSchema>;
export type PlatformRefreshSessionRequest = z.infer<typeof platformRefreshSessionRequestSchema>;
export type PlatformRefreshSessionResponse = z.infer<typeof platformRefreshSessionResponseSchema>;
export type PlatformSessionSignInResponse = z.infer<typeof platformSessionSignInResponseSchema>;
export type PlatformSessionSignOutRequest = z.infer<typeof platformSessionSignOutRequestSchema>;
export type PlatformSignInRequest = z.infer<typeof platformSignInRequestSchema>;
export type PlatformSignInResponse = z.infer<typeof platformSignInResponseSchema>;
export type PlatformSignOutRequest = z.infer<typeof platformSignOutRequestSchema>;
export type PlatformSignOutResponse = z.infer<typeof platformSignOutResponseSchema>;
