import { z } from 'zod';

import { platformUserViewSchema } from '../users.contracts';

export const PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH = 128;

export const platformEmailConfirmationTokenSchema = z
  .string()
  .min(1)
  .max(PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH);

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

export const platformPendingSignUpResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export const platformConfirmEmailRequestSchema = z
  .object({
    token: platformEmailConfirmationTokenSchema,
  })
  .strict();

export const platformConfirmEmailResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export const platformResendEmailConfirmationRequestSchema = z
  .object({
    email: z.email().max(320),
  })
  .strict();

export const platformResendEmailConfirmationResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export type PlatformConfirmEmailRequest = z.infer<typeof platformConfirmEmailRequestSchema>;
export type PlatformConfirmEmailResponse = z.infer<typeof platformConfirmEmailResponseSchema>;
export type PlatformPendingSignUpResponse = z.infer<typeof platformPendingSignUpResponseSchema>;
export type PlatformResendEmailConfirmationRequest = z.infer<
  typeof platformResendEmailConfirmationRequestSchema
>;
export type PlatformResendEmailConfirmationResponse = z.infer<
  typeof platformResendEmailConfirmationResponseSchema
>;
export type PlatformSignUpRequest = z.infer<typeof platformSignUpRequestSchema>;
export type PlatformSignUpResponse = z.infer<typeof platformSignUpResponseSchema>;
