import { z } from 'zod';

import { PLATFORM_IDENTITY_POLICY } from '../identity.constants';
import { platformIdentityEmailSchema, platformSignUpPasswordSchema } from './identity.contracts';

export const PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH = 128;
export const PLATFORM_REGISTRATION_EMAIL_MAX_LENGTH = 254;

// Registration mailbox admission is active; sign-in retains its existing identity bound.
export const platformRegistrationEmailSchema = platformIdentityEmailSchema.refine(
  /** Bounds active registration recipients without narrowing existing sign-in identity lookup. */
  (email) => email.length <= PLATFORM_REGISTRATION_EMAIL_MAX_LENGTH,
);

export const platformEmailConfirmationTokenSchema = z
  .string()
  .min(1)
  .max(PLATFORM_EMAIL_CONFIRMATION_TOKEN_MAX_LENGTH);

export const platformSignUpRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(PLATFORM_IDENTITY_POLICY.DISPLAY_NAME_MAX_LENGTH),
    email: platformRegistrationEmailSchema,
    password: platformSignUpPasswordSchema,
  })
  .strict();

export const platformPreparedSignUpRequestSchema = platformSignUpRequestSchema;

export const platformPendingSignUpResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export const platformSignUpResponseSchema = platformPendingSignUpResponseSchema;

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
    email: platformRegistrationEmailSchema,
  })
  .strict();

export const platformPreparedResendEmailConfirmationRequestSchema =
  platformResendEmailConfirmationRequestSchema;

export const platformResendEmailConfirmationResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export type PlatformConfirmEmailRequest = z.infer<typeof platformConfirmEmailRequestSchema>;
export type PlatformConfirmEmailResponse = z.infer<typeof platformConfirmEmailResponseSchema>;
export type PlatformPendingSignUpResponse = z.infer<typeof platformPendingSignUpResponseSchema>;
export type PlatformPreparedResendEmailConfirmationRequest = z.infer<
  typeof platformPreparedResendEmailConfirmationRequestSchema
>;
export type PlatformPreparedSignUpRequest = z.infer<typeof platformPreparedSignUpRequestSchema>;
export type PlatformResendEmailConfirmationRequest = z.infer<
  typeof platformResendEmailConfirmationRequestSchema
>;
export type PlatformResendEmailConfirmationResponse = z.infer<
  typeof platformResendEmailConfirmationResponseSchema
>;
export type PlatformSignUpRequest = z.infer<typeof platformSignUpRequestSchema>;
export type PlatformSignUpResponse = z.infer<typeof platformSignUpResponseSchema>;
