import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { BadRequestException } from '@nestjs/common';
import {
  parseRegistrationConfirmation,
  parseRegistrationResend,
  parseRegistrationSignUp,
} from '@platform/auth/registration/registration.validation';
import { expect, test } from 'vitest';

const INPUT = {
  displayName: ' Reviewer ',
  email: ' Reviewer@Example.Test ',
  password: ' password ',
};

/** Proves invalid string candidates and structural errors retain distinct fixed safe envelopes. */
function confirmationBoundary(): void {
  for (const token of ['', 'x'.repeat(129)]) {
    expect(
      /** Exercises the invalid-string envelope without crypto, SQL or a service instance. */
      () => parseRegistrationConfirmation({ token }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: AUTH_ERROR_CODE.CONFIRMATION_INVALID }),
      }),
    );
  }

  for (const input of [null, [], { token: null }, { extra: true, token: '' }]) {
    expect(
      /** Exercises only structural rejection, not token authority. */
      () => parseRegistrationConfirmation(input),
    ).toThrow(BadRequestException);
  }

  expect(parseRegistrationConfirmation({ token: 'malformed' })).toEqual({ token: 'malformed' });
}

/** Proves prepared mailbox bounds and D1 syntax validation while retaining strict request shapes. */
function mailboxBoundary(): void {
  const oversized = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`;
  const maximum = oversized.slice(0, -1);
  expect(maximum.length).toBe(254);
  expect(parseRegistrationResend({ email: maximum })).toEqual({ email: maximum });

  for (const email of [oversized, `${'a'.repeat(65)}@example.test`]) {
    expect(
      /** Rejects an inadmissible signup recipient before orchestration starts. */
      () => parseRegistrationSignUp({ ...INPUT, email }),
    ).toThrow('Invalid Platform request');
    expect(
      /** Applies the same mailbox policy to resend. */
      () => parseRegistrationResend({ email }),
    ).toThrow('Invalid Platform request');
  }

  expect(
    /** Preserves strict signup validation through the reused request parser. */
    () => parseRegistrationSignUp({ ...INPUT, extra: true }),
  ).toThrow(BadRequestException);
  expect(
    /** Preserves strict resend validation through the reused request parser. */
    () => parseRegistrationResend({ email: INPUT.email, extra: true }),
  ).toThrow(BadRequestException);
}

/** Proves normalized identity/display name and unchanged exact password bytes without state or providers. */
function normalizedCommands(): void {
  expect(parseRegistrationSignUp(INPUT)).toEqual({
    displayName: 'Reviewer',
    email: 'reviewer@example.test',
    password: INPUT.password,
  });
  expect(parseRegistrationResend({ email: INPUT.email })).toEqual({
    email: 'reviewer@example.test',
  });
}

test('confirmation parsing preserves safe string-versus-shape rejection', confirmationBoundary);
test('prepared parsing retains mailbox and strict-shape boundaries', mailboxBoundary);
test('prepared commands normalize identity without mutating password bytes', normalizedCommands);
