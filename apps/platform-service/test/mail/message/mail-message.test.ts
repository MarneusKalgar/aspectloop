import { hasMailControlCharacters, isMailAddress } from '@platform/mail/message/mail-message';
import { MAIL_ADDRESS_MAX_LENGTH, MAIL_CHARACTER } from '@platform/mail/message/mail.constants';
import { SMTP_LIMITS } from '@platform/mail/smtp/smtp.constants';
import { expect, test } from 'vitest';

/** Rejects every ASCII control byte and DEL without widening the rule to ordinary characters. */
function testControlBoundaries(): void {
  for (let code = 0; code <= 31; code += 1) {
    expect(hasMailControlCharacters(`prefix${String.fromCharCode(code)}suffix`)).toBe(true);
  }

  expect(hasMailControlCharacters(String.fromCharCode(127))).toBe(true);
  expect(hasMailControlCharacters(String.fromCharCode(32))).toBe(false);
  expect(hasMailControlCharacters(String.fromCharCode(126))).toBe(false);
  expect(hasMailControlCharacters(String.fromCharCode(128))).toBe(false);
  expect(hasMailControlCharacters('Ordinary text')).toBe(false);
}

/** Uses valid DNS label lengths to exercise the 254-character mailbox boundary precisely. */
function testMailboxBoundary(): void {
  const local = 'a'.repeat(64);
  const domainPrefix = `${'b'.repeat(63)}.${'c'.repeat(63)}.`;
  const atLimit = `${local}@${domainPrefix}${'d'.repeat(61)}`;
  const aboveLimit = `${local}@${domainPrefix}${'d'.repeat(62)}`;

  expect(atLimit).toHaveLength(254);
  expect(aboveLimit).toHaveLength(255);
  expect(isMailAddress(atLimit)).toBe(true);
  expect(isMailAddress(aboveLimit)).toBe(false);
}

/** Pins policy values independently of their consumers while retaining immutable protocol limits. */
function testNamedLimits(): void {
  expect(MAIL_CHARACTER).toEqual({ ASCII_CONTROL_MAX: 0x1f, ASCII_DELETE: 0x7f });
  expect(MAIL_ADDRESS_MAX_LENGTH).toBe(254);
  expect(SMTP_LIMITS).toEqual({ RESPONSE_BYTES: 16_384 });
  expect(Object.isFrozen(MAIL_CHARACTER)).toBe(true);
  expect(Object.isFrozen(SMTP_LIMITS)).toBe(true);
}

test('names and freezes protocol limits without changing policy', testNamedLimits);
test('preserves exact ASCII control boundaries', testControlBoundaries);
test('accepts the mailbox limit and refuses the next character', testMailboxBoundary);
