/** Local presentation policy only; Platform's configured cooldown remains authoritative. */
export const RESEND_UI_WAIT_MS = 60_000;
export const RESEND_COUNTDOWN_TICK_MS = 1000;

/** Safe resend presentation feedback; null remains the absence of feedback, not an outcome. */
export const RESEND_FEEDBACK = Object.freeze({
  ACCEPTED: 'accepted',
  ERROR: 'error',
  RATE_LIMITED: 'rateLimited',
} as const);

export type ResendFeedback = (typeof RESEND_FEEDBACK)[keyof typeof RESEND_FEEDBACK];
