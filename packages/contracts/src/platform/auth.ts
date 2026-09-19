import { z } from 'zod';

import { platformUserViewSchema } from './users';

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

export const platformSignUpRequestSchema = z
  .object({
    displayName: z.string().min(1).max(120),
    email: z.string().min(1).max(320),
    password: z.string().min(1),
  })
  .strict();

export const platformSignUpResponseSchema = z
  .object({
    success: z.literal(true),
    user: platformUserViewSchema,
  })
  .strict();

export type PlatformSignInRequest = z.infer<typeof platformSignInRequestSchema>;
export type PlatformSignInResponse = z.infer<typeof platformSignInResponseSchema>;
export type PlatformSignOutRequest = z.infer<typeof platformSignOutRequestSchema>;
export type PlatformSignOutResponse = z.infer<typeof platformSignOutResponseSchema>;
export type PlatformSignUpRequest = z.infer<typeof platformSignUpRequestSchema>;
export type PlatformSignUpResponse = z.infer<typeof platformSignUpResponseSchema>;
