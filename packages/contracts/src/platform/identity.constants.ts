/** Stable identity-field bounds shared by private transport and Platform behavior. */
export const PLATFORM_IDENTITY_POLICY = Object.freeze({
  DISPLAY_NAME_MAX_LENGTH: 120,
  EMAIL_MAX_LENGTH: 320,
  PASSWORD_MAX_UTF8_BYTES: 72,
  PASSWORD_MIN_CHARACTERS: 8,
} as const);
