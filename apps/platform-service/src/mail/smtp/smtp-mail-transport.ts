import type { MailAttempt, MailMessage, MailTransport } from '../mail.port';

import { SmtpMailAttempt } from './smtp-mail-attempt';

export interface SmtpMailSettings {
  from: string;
  host: string;
  password?: string;
  port: number;
  secure: boolean;
  user?: string;
}

/** Creates isolated SMTP attempts without a provider pool, queue, retry, or logger. */
export class SmtpMailTransport implements MailTransport {
  /** Retains validated provider settings, never recipient-specific diagnostics. */
  constructor(private readonly settings: SmtpMailSettings) {}

  /** Delegates one send and all of its owned resources to a cancellable lifecycle. */
  start(message: MailMessage): MailAttempt {
    const attempt = new SmtpMailAttempt(this.settings, message);

    attempt.start();

    return attempt;
  }
}
