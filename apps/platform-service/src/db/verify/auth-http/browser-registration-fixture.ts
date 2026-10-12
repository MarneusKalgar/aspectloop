import type { DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { OpaqueTokenService } from '#app/auth/credentials/opaque-token.service';
import { EMAIL_CONFIRMATION } from '#app/auth/registration/registration.constants';
import { MAIL_LIMITS } from '#app/mail/mail.port';
import { User } from '#app/users/user.entity';

import { OwnedMailCapture } from '../mail/owned-mail-capture';
import { assertLocalRegistrationMail } from '../registration/verification-support';

export const BROWSER_REGISTRATION_MODES = [
  '--browser-registration-reserve',
  '--browser-registration-token',
  '--browser-registration-cleanup',
] as const;
const OWNERSHIP_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Reuses D3's exact recipient/mail ownership for a genuine browser-created account. */
export async function browserRegistrationFixture(
  mode: string,
  id: string,
  cleanup: DataSource,
  environment: EnvironmentVariables,
): Promise<void> {
  if (
    !OWNERSHIP_ID_PATTERN.test(id) ||
    !BROWSER_REGISTRATION_MODES.some(
      /** Rejects any unplanned action before acquiring mail/database resources. */ (candidate) =>
        candidate === mode,
    )
  ) {
    throw new Error('Browser registration ownership/action rejected');
  }

  assertLocalRegistrationMail(environment);
  const email = `auth-http-${id}@example.test`;
  const capture = new OwnedMailCapture(email, EMAIL_CONFIRMATION.SUBJECT);

  if (mode === '--browser-registration-reserve') {
    assert.equal(await cleanup.getRepository(User).countBy({ email }), 0);
    await capture.assertAvailable();
    await capture.assertEmpty();
    console.log('E2_RESERVED');
    return;
  }

  if (mode === '--browser-registration-token') {
    if (process.stdout.isTTY || process.env.ASPECTLOOP_E2_PRIVATE_PIPE !== '1') {
      throw new Error('Browser confirmation capture requires its private pipe');
    }

    const tokens = await capture.readConfirmationTokens(
      1,
      environment.SMTP_FROM,
      environment.WEB_PUBLIC_BASE_URL,
      new OpaqueTokenService(new ConfigService(environment)),
    );
    const user = await cleanup.getRepository(User).findOneBy({ email });
    assert.ok(user);
    // This guarded private pipe is the intended tool exchange, never a diagnostic log.
    process.stdout.write(`E2_LINK ${JSON.stringify({ id: user.id, token: tokens[0] })}\n`);
    return;
  }

  if (mode !== '--browser-registration-cleanup') {
    throw new Error('Browser registration fixture mode rejected');
  }

  // Under the exclusive-local runner contract, bound any commit-adjacent SMTP send before cleanup.
  await new Promise<void>(
    /** Allows already-dispatched work to settle before exact owned capture cleanup. */ (resolve) =>
      setTimeout(resolve, MAIL_LIMITS.DEADLINE_MS + MAIL_LIMITS.PHASE_TIMEOUT_MS),
  );
  await capture.cleanup();
  await capture.assertEmpty();
  const user = await cleanup.getRepository(User).findOneBy({ email });

  if (user) {
    await cleanup.getRepository(User).delete({ email, id: user.id });
  }

  assert.equal(await cleanup.getRepository(User).countBy({ email }), 0);
  console.log('E2_CLEANED');
}
