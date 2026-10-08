export const MAIL_DISPATCHER = Symbol('PlatformMailDispatcher');

export const MAIL_LIMITS = Object.freeze({
  ACTIVE: 2,
  DEADLINE_MS: 5000,
  PHASE_TIMEOUT_MS: 1500,
  SUBJECT_BYTES: 200,
  TEXT_BYTES: 16_384,
  WAITING: 100,
});

export const MAIL_ADMISSION = Object.freeze({
  INVALID_MESSAGE: 'invalid-message',
  QUEUE_FULL: 'queue-full',
  QUEUED: 'queued',
  STOPPED: 'stopped',
} as const);

export const MAIL_OUTCOME = Object.freeze({
  SENT: 'sent',
  SMTP_FAILED: 'smtp-failed',
  STOPPED: 'stopped',
  TIMEOUT: 'timeout',
} as const);

export type MailAdmission = (typeof MAIL_ADMISSION)[keyof typeof MAIL_ADMISSION];
export interface MailAttempt {
  /** Physically closes owned sockets/streams without throwing; repeated cancellation is harmless. */
  cancel(): void;
  result: Promise<MailAttemptOutcome>;
}
export type MailAttemptOutcome = Exclude<MailOutcome, typeof MAIL_OUTCOME.STOPPED>;

export interface MailDispatcher {
  /** Admits bounded plain text after the owning transaction has committed. */
  enqueue(message: MailMessage): MailReceipt;
}
export interface MailMessage {
  subject: string;
  text: string;
  to: string;
}
export type MailOutcome = (typeof MAIL_OUTCOME)[keyof typeof MAIL_OUTCOME];

export interface MailReceipt {
  admission: MailAdmission;
  /** Private evidence only; registration callers must not await delivery. Never rejects. */
  completion?: Promise<MailOutcome>;
}

export type MailReportCategory =
  Exclude<MailOutcome, typeof MAIL_OUTCOME.SENT> | typeof MAIL_ADMISSION.QUEUE_FULL;

export interface MailTransport {
  /** Starts exactly one cancellable send without a hidden pool or retry queue. */
  start(message: MailMessage): MailAttempt;
}
