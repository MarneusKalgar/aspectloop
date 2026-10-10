import type { MailMessage } from '#app/mail/mail.port';

import type { RegistrationMailWork } from './registration.types';

import { EMAIL_CONFIRMATION } from './registration.constants';

/** Renders fixed plain text and the configured Web-origin fragment link without profile interpolation. */
export function createConfirmationMessage(
  webBaseUrl: string,
  work: RegistrationMailWork,
): MailMessage {
  const link = new URL(EMAIL_CONFIRMATION.PATH, webBaseUrl);
  link.hash = `token=${work.rawToken}`;

  return {
    subject: EMAIL_CONFIRMATION.SUBJECT,
    text: `Use this link to confirm your email:\n\n${link.href}\n\nIf you did not request this email, you can ignore it.`,
    to: work.to,
  };
}
