import type { OnApplicationShutdown } from '@nestjs/common';

import {
  MAIL_ADMISSION,
  MAIL_LIMITS,
  MAIL_OUTCOME,
  type MailAttempt,
  type MailDispatcher,
  type MailMessage,
  type MailOutcome,
  type MailReceipt,
  type MailReportCategory,
  type MailTransport,
} from '../mail.port';
import { isMailMessage } from '../message/mail-message';

interface PendingMail {
  attempt: MailAttempt | null;
  message: MailMessage | null;
  settle: (outcome: MailOutcome) => void;
  settled: boolean;
  timer: null | ReturnType<typeof setTimeout>;
}

/** Owns all admission, deadlines, and shutdown; queued mail is intentionally not durable. */
export class BoundedMailDispatcher implements MailDispatcher, OnApplicationShutdown {
  private readonly active = new Set<PendingMail>();
  private reportingFailed = false;
  private stopped = false;
  private readonly waiting: PendingMail[] = [];

  /** Accepts a provider port and an optional fixed-category-only observer. */
  constructor(
    private readonly transport: MailTransport,
    private readonly report?: (category: MailReportCategory) => void,
  ) {}

  /** Returns immediately; completion exists for private verification, not HTTP responses. */
  enqueue(message: MailMessage): MailReceipt {
    if (this.stopped) {
      return { admission: MAIL_ADMISSION.STOPPED };
    }

    if (!isMailMessage(message)) {
      return { admission: MAIL_ADMISSION.INVALID_MESSAGE };
    }

    if (this.waiting.length >= MAIL_LIMITS.WAITING) {
      this.reportSafely(MAIL_ADMISSION.QUEUE_FULL);

      return { admission: MAIL_ADMISSION.QUEUE_FULL };
    }

    /** Retains only an immutable snapshot until settlement. */
    const completion = new Promise<MailOutcome>((settle) => {
      this.waiting.push({
        attempt: null,
        message: { subject: message.subject, text: message.text, to: message.to },
        settle,
        settled: false,
        timer: null,
      });
    });

    this.dispatchWaiting();

    return { admission: MAIL_ADMISSION.QUEUED, completion };
  }

  /** Exposes bounded observer-failure evidence without retaining diagnostics or reporting recursively. */
  hasReportingFailure(): boolean {
    return this.reportingFailed;
  }

  /** Stops admission and discards queued mail while physically cancelling active sends. */
  onApplicationShutdown(): void {
    this.stopped = true;

    for (const pending of [...this.active, ...this.waiting.splice(0)]) {
      this.finish(pending, MAIL_OUTCOME.STOPPED);
    }
  }

  /** Starts work only when an application-owned worker slot is free. */
  private dispatchWaiting(): void {
    while (!this.stopped && this.active.size < MAIL_LIMITS.ACTIVE && this.waiting.length > 0) {
      const pending = this.waiting.shift();

      if (!pending?.message) {
        continue;
      }

      this.active.add(pending);

      /** Cancels the physical attempt before releasing its worker at the total deadline. */
      pending.timer = setTimeout(
        /** Enforces the total worker deadline even if provider completion never arrives. */
        () => this.finish(pending, MAIL_OUTCOME.TIMEOUT),
        MAIL_LIMITS.DEADLINE_MS,
      );

      try {
        pending.attempt = this.transport.start(pending.message);
        pending.message = null;

        void pending.attempt.result.then(
          /** Converts transport success/failure into a settled, private-free outcome. */
          (outcome) => this.finish(pending, outcome),
          /** Never forwards a provider exception or rejects a delivery receipt. */
          () => this.finish(pending, MAIL_OUTCOME.SMTP_FAILED),
        );
      } catch {
        this.finish(pending, MAIL_OUTCOME.SMTP_FAILED);
      }
    }
  }

  /** Settles once; uncertain cancellation halts admission instead of exceeding physical limits. */
  private finish(pending: PendingMail, outcome: MailOutcome): void {
    if (pending.settled) {
      return;
    }

    pending.settled = true;

    if (pending.timer !== null) {
      clearTimeout(pending.timer);
    }

    const attempt = pending.attempt;
    pending.attempt = null;
    pending.timer = null;
    pending.message = null;
    let cancellationFailed = false;

    try {
      attempt?.cancel();
    } catch {
      // A broken provider contract cannot permit another potentially concurrent SMTP attempt.
      cancellationFailed = true;
      this.stopped = true;
    }

    this.active.delete(pending);

    const settledOutcome =
      cancellationFailed && outcome !== MAIL_OUTCOME.STOPPED ? MAIL_OUTCOME.SMTP_FAILED : outcome;

    pending.settle(settledOutcome);

    if (settledOutcome !== MAIL_OUTCOME.SENT) {
      this.reportSafely(settledOutcome);
    }

    if (cancellationFailed) {
      this.onApplicationShutdown();
    } else {
      this.dispatchWaiting();
    }
  }

  /** Keeps optional diagnostics from changing admission, settlement, or worker progression. */
  private reportSafely(category: MailReportCategory): void {
    try {
      this.report?.(category);
    } catch {
      this.reportingFailed = true;
    }
  }
}
