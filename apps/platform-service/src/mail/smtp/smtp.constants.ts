/** Bounds SMTP replies independently of application message-body size. */
export const SMTP_LIMITS = Object.freeze({
  RESPONSE_BYTES: 16_384,
} as const);
