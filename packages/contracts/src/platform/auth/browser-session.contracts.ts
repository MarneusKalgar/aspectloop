import { z } from 'zod';

import { platformUserViewSchema } from '../users.contracts';

/** Maximum encoded length accepted for an opaque browser-session credential. */
export const PLATFORM_BROWSER_SESSION_CREDENTIAL_MAX_LENGTH = 128;

/** Bounded credential exchanged only between Gateway and Platform. */
export const platformBrowserSessionCredentialSchema = z
  .string()
  .min(1)
  .max(PLATFORM_BROWSER_SESSION_CREDENTIAL_MAX_LENGTH);

/** Private sign-in result used by Gateway to establish the cookie until its absolute expiry. */
export const platformBrowserSessionSignInResponseSchema = z
  .object({
    sessionCredential: platformBrowserSessionCredentialSchema,
    sessionExpiresAt: z.iso.datetime({ offset: true }),
    user: platformUserViewSchema,
  })
  .strict();

/** Gateway-owned validation command for one browser request. */
export const platformBrowserSessionValidationRequestSchema = z
  .object({
    recordActivity: z.boolean(),
    sessionCredential: platformBrowserSessionCredentialSchema,
  })
  .strict();

/** Secret-free authoritative identity and absolute expiry returned after validation. */
export const platformBrowserSessionValidationResponseSchema = z
  .object({
    sessionExpiresAt: z.iso.datetime({ offset: true }),
    sessionId: z.uuid(),
    user: platformUserViewSchema,
  })
  .strict();

/** Private sign-out command authenticated by the browser-session credential. */
export const platformBrowserSessionSignOutRequestSchema = z
  .object({
    sessionCredential: platformBrowserSessionCredentialSchema,
  })
  .strict();

/** Confirmed Platform revocation result for an explicit sign-out. */
export const platformBrowserSessionSignOutResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export type PlatformBrowserSessionSignInResponse = z.infer<
  typeof platformBrowserSessionSignInResponseSchema
>;
export type PlatformBrowserSessionSignOutRequest = z.infer<
  typeof platformBrowserSessionSignOutRequestSchema
>;
export type PlatformBrowserSessionSignOutResponse = z.infer<
  typeof platformBrowserSessionSignOutResponseSchema
>;
export type PlatformBrowserSessionValidationRequest = z.infer<
  typeof platformBrowserSessionValidationRequestSchema
>;
export type PlatformBrowserSessionValidationResponse = z.infer<
  typeof platformBrowserSessionValidationResponseSchema
>;
