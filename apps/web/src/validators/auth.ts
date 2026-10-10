import { PLATFORM_REGISTRATION_EMAIL_MAX_LENGTH } from '@aspectloop/contracts/platform';
import { z } from 'zod';

type Translate = (key: string) => string;

export function createSignInSchema(t: Translate) {
  return z.object({
    email: z.email({ message: t('auth.validation.email.invalid') }),
    password: z.string().min(1, { message: t('auth.validation.password.required') }),
  });
}

/** Validates active registration mailbox admission without trimming credential bytes. */
export function createSignUpSchema(t: Translate) {
  return z.object({
    displayName: z
      .string()
      .trim()
      .min(1, { message: t('auth.validation.displayName.required') }),
    email: z
      .email({ message: t('auth.validation.email.invalid') })
      .max(PLATFORM_REGISTRATION_EMAIL_MAX_LENGTH, { message: t('auth.validation.email.invalid') }),
    password: z
      .string()
      .min(1, { message: t('auth.validation.password.required') })
      .min(8, { message: t('auth.validation.password.minLength') }),
  });
}
