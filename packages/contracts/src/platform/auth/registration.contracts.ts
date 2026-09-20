import { z } from 'zod';

import { PLATFORM_IDENTITY_POLICY } from '../identity.constants';
import { platformUserViewSchema } from '../users.contracts';
import { platformIdentityEmailSchema, platformSignUpPasswordSchema } from './identity.contracts';

export const PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH = 128;

export const platformEmailConfirmationTokenSchema = z
  .string()
  .min(1)
  .max(PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH);

export const platformSignUpRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(PLATFORM_IDENTITY_POLICY.DISPLAY_NAME_MAX_LENGTH),
    email: platformIdentityEmailSchema,
    password: platformSignUpPasswordSchema,
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
    email: platformIdentityEmailSchema,
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
