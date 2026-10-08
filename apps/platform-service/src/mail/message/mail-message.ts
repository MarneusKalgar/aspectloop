import { isEmail } from 'class-validator';

import { MAIL_LIMITS, type MailMessage } from '../mail.port';
import { MAIL_ADDRESS_MAX_LENGTH, MAIL_CHARACTER } from './mail.constants';

/** Rejects ASCII control bytes without a control-character regular expression. */
export function hasMailControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code <= MAIL_CHARACTER.ASCII_CONTROL_MAX || code === MAIL_CHARACTER.ASCII_DELETE) {
      return true;
    }
  }

  return false;
}

/** Accepts exactly one bare mailbox without control characters or display headers. */
export function isMailAddress(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAIL_ADDRESS_MAX_LENGTH &&
    !/[\s<>]/.test(value) &&
    !hasMailControlCharacters(value) &&
    isEmail(value)
  );
}

/** Bounds retained memory and rejects header injection before queue admission. */
export function isMailMessage(message: MailMessage): boolean {
  return (
    isMailAddress(message.to) &&
    typeof message.subject === 'string' &&
    message.subject.length > 0 &&
    !hasMailControlCharacters(message.subject) &&
    Buffer.byteLength(message.subject) <= MAIL_LIMITS.SUBJECT_BYTES &&
    typeof message.text === 'string' &&
    !message.text.includes('\0') &&
    Buffer.byteLength(message.text) <= MAIL_LIMITS.TEXT_BYTES
  );
}
