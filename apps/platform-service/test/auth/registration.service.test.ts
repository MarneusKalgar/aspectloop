import type { PasswordService } from '@platform/auth/credentials/password.service';
import type { RegistrationStore } from '@platform/auth/registration/registration.store';

import {
  AUTH_ERROR_CODE,
  platformSignInRequestSchema,
  platformSignUpRequestSchema,
} from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import { AuthIdentityLimiter } from '@platform/auth/limits/auth-identity-limiter';
import { RegistrationService } from '@platform/auth/registration/registration.service';
import {
  MAIL_ADMISSION,
  MAIL_OUTCOME,
  type MailDispatcher,
  type MailOutcome,
} from '@platform/mail/mail.port';
import { expect, test, vi } from 'vitest';

const INPUT = {
  displayName: ' Reviewer ',
  email: ' Reviewer@Example.Test ',
  password: ' password ',
};
const WORK = {
  rawToken: `00000000-0000-4000-8000-000000000001.${'A'.repeat(43)}`,
  to: 'reviewer@example.test',
};

/** Proves no enqueue before the store's committed result, and no HTTP wait for mail completion. */
async function afterCommitOnly(): Promise<void> {
  const context = fixture();
  const committed = deferred<typeof WORK>();
  const delivery = deferred<MailOutcome>();
  context.store.signUp.mockReturnValueOnce(committed.promise);
  context.enqueue.mockReturnValueOnce({
    admission: MAIL_ADMISSION.QUEUED,
    completion: delivery.promise,
  });
  const result = context.service.signUp(INPUT);
  await Promise.resolve();
  await Promise.resolve();
  expect(context.enqueue).not.toHaveBeenCalled();
  committed.resolve(WORK);
  await expect(result).resolves.toEqual({ success: true });
  expect(context.enqueue).toHaveBeenCalledOnce();
}

/** Proves malformed strings map uniformly without passing oversize candidates to crypto or SQL. */
async function confirmationBoundary(): Promise<void> {
  const context = fixture();

  for (const token of ['', 'x'.repeat(129)]) {
    await expect(context.service.confirm({ token })).rejects.toMatchObject({
      response: { code: AUTH_ERROR_CODE.CONFIRMATION_INVALID },
    });
  }

  for (const input of [{ token: null }, { extra: true, token: WORK.rawToken }, null]) {
    await expect(context.service.confirm(input)).rejects.toMatchObject({ status: 400 });
  }

  expect(context.store.confirm).not.toHaveBeenCalled();
  await expect(context.service.confirm({ token: WORK.rawToken })).resolves.toEqual({
    success: true,
  });
  expect(context.store.confirm).toHaveBeenCalledWith(WORK.rawToken);
}

/** Creates an explicit unresolved boundary using the repository's ES2023 library target. */
function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let release: ((value: T) => void) | undefined;
  const promise = new Promise<T>(
    /** Captures settlement synchronously without timers or an empty placeholder callback. */
    (resolve) => {
      release = resolve;
    },
  );

  return {
    promise,
    /** Releases the test-owned commit/delivery boundary only when explicitly requested. */
    resolve(value: T): void {
      if (!release) {
        throw new Error('Deferred boundary was not initialized');
      }

      release(value);
    },
  };
}

/** Proves private queue/SMTP outcomes never compensate or change generic command acceptance. */
async function deliveryFailure(): Promise<void> {
  for (const admission of [
    MAIL_ADMISSION.QUEUE_FULL,
    MAIL_ADMISSION.STOPPED,
    MAIL_ADMISSION.QUEUED,
  ]) {
    const context = fixture();
    context.enqueue.mockReturnValue({
      admission,
      completion: Promise.resolve(MAIL_OUTCOME.SMTP_FAILED),
    });
    await expect(context.service.signUp(INPUT)).resolves.toEqual({ success: true });
    expect(context.store.signUp).toHaveBeenCalledOnce();
    expect(context.enqueue).toHaveBeenCalledOnce();
  }
}

/** Builds command boundaries without networking or persistent state. */
function fixture() {
  const store = {
    confirm: vi.fn().mockResolvedValue(undefined),
    resend: vi.fn().mockResolvedValue(null),
    signUp: vi.fn().mockResolvedValue(WORK),
  };
  const passwords = { hash: vi.fn().mockResolvedValue('private-hash') };
  const enqueue = vi
    .fn<MailDispatcher['enqueue']>()
    .mockReturnValue({ admission: MAIL_ADMISSION.QUEUED });
  const service = new RegistrationService(
    store as unknown as RegistrationStore,
    passwords as unknown as PasswordService,
    new AuthIdentityLimiter(),
    new ConfigService({ WEB_PUBLIC_BASE_URL: 'http://localhost:5173' }),
    { enqueue },
  );

  return { enqueue, passwords, service, store };
}

/** Proves shape errors and D1 mailbox disagreements are rejected before hash/SQL/admission. */
async function inputBoundary(): Promise<void> {
  const context = fixture();
  const oversized = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`;
  const badSyntax = `${'a'.repeat(65)}@example.test`;
  expect(oversized.length).toBe(255);
  expect(platformSignUpRequestSchema.safeParse({ ...INPUT, email: oversized }).success).toBe(true);
  expect(
    platformSignInRequestSchema.safeParse({ email: oversized, password: INPUT.password }).success,
  ).toBe(true);

  for (const email of [oversized, badSyntax]) {
    await expect(context.service.signUp({ ...INPUT, email })).rejects.toMatchObject({
      status: 400,
    });
  }

  await expect(context.service.signUp({ ...INPUT, extra: true })).rejects.toMatchObject({
    status: 400,
  });
  expect(context.passwords.hash).not.toHaveBeenCalled();
  expect(context.store.signUp).not.toHaveBeenCalled();
  await expect(
    context.service.signUp({ ...INPUT, email: oversized.slice(0, -1) }),
  ).resolves.toEqual({ success: true });
  await context.service.signUp(INPUT);
  await context.service.signUp(INPUT);
  await context.service.signUp(INPUT);
  expect(context.store.signUp).toHaveBeenCalledTimes(4);
}

/** Proves normalization, exact password bytes and secret-free generic signup projection. */
async function preparedSignup(): Promise<void> {
  const context = fixture();
  await expect(context.service.signUp(INPUT)).resolves.toEqual({ success: true });
  expect(context.passwords.hash).toHaveBeenCalledWith(' password ');
  expect(context.store.signUp).toHaveBeenCalledWith({
    displayName: 'Reviewer',
    email: WORK.to,
    passwordHash: 'private-hash',
  });
  expect(context.enqueue).toHaveBeenCalledWith({
    subject: 'Confirm your AspectLoop email',
    text: `Use this link to confirm your email:\n\nhttp://localhost:5173/confirm-email#token=${WORK.rawToken}\n\nIf you did not request this email, you can ignore it.`,
    to: WORK.to,
  });
}

/** Proves signup/resend share three admissions and database failures are not refunded. */
async function sharedAdmission(): Promise<void> {
  const context = fixture();
  context.store.resend.mockRejectedValueOnce(new Error('private database failure'));
  await expect(context.service.resend({ email: WORK.to })).rejects.toThrow();
  await context.service.signUp(INPUT);
  await context.service.resend({ email: WORK.to });
  await expect(context.service.signUp(INPUT)).resolves.toEqual({ success: true });
  expect(context.store.resend).toHaveBeenCalledTimes(2);
  expect(context.store.signUp).toHaveBeenCalledOnce();
  expect(context.passwords.hash).toHaveBeenCalledOnce();
}

test('prepared signup normalizes identity and returns no private work', preparedSignup);
test('mail starts after commit and is not awaited by the command', afterCommitOnly);
test('prepared mailbox validation preserves legacy identity contracts', inputBoundary);
test('confirmation separates invalid strings from structural validation', confirmationBoundary);
test('signup/resend share count-before-work admission without refunds', sharedAdmission);
test('mail failure does not change committed command acceptance', deliveryFailure);
