import type { SMTPEnvelope } from 'nodemailer/lib/smtp-connection';

import MailComposer from 'nodemailer/lib/mail-composer';

import type { MailMessage } from '../mail.port';

import { isMailAddress } from '../message/mail-message';

export type CompiledMail = ReturnType<MailComposer['compile']>;

/** Compiles only bounded plain text, without file/URL access or caller-controlled headers. */
export function compileSmtpMessage(from: string, message: MailMessage): CompiledMail {
  return new MailComposer({
    disableFileAccess: true,
    disableUrlAccess: true,
    from,
    subject: message.subject,
    text: message.text,
    to: message.to,
  }).compile();
}

/** Narrows MIME's optional null sender to the single-mailbox SMTP contract without a cast. */
export function smtpEnvelope(compiled: CompiledMail): SMTPEnvelope {
  const envelope = compiled.getEnvelope();

  if (!isMailAddress(envelope.from) || envelope.to.length !== 1 || !isMailAddress(envelope.to[0])) {
    throw new Error('Invalid SMTP envelope');
  }

  return { from: envelope.from, to: envelope.to };
}
