import { z } from 'zod';

import { PLATFORM_IDENTITY_POLICY } from '../identity.constants';

export const platformIdentityEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(PLATFORM_IDENTITY_POLICY.EMAIL_MAX_LENGTH));

export const platformSignInPasswordSchema = z
  .string()
  .min(1)
  .refine(hasSupportedPasswordByteLength);

export const platformSignUpPasswordSchema = z
  .string()
  .min(PLATFORM_IDENTITY_POLICY.PASSWORD_MIN_CHARACTERS)
  .refine(hasSupportedPasswordByteLength);

/** Returns whether a password fits bcrypt's exact UTF-8 input boundary. */
function hasSupportedPasswordByteLength(value: string): boolean {
  return (
    new TextEncoder().encode(value).byteLength <= PLATFORM_IDENTITY_POLICY.PASSWORD_MAX_UTF8_BYTES
  );
}
