import type { DataSource } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { OpaqueTokenService } from '#app/auth/credentials/opaque-token.service';
import { IDENTITY_LIMITS } from '#app/auth/limits/identity-limit.constants';
import { EmailVerificationToken } from '#app/auth/registration/model/email-verification-token.entity';
import { EMAIL_CONFIRMATION } from '#app/auth/registration/registration.constants';
import { MAIL_LIMITS } from '#app/mail/mail.port';
import { User } from '#app/users/user.entity';

import type { OwnedAuthFixture } from './fixture';

import { OwnedMailCapture } from '../mail/owned-mail-capture';
import { OwnedRegistrationFixtures, signupInput } from '../registration/verification-support';
import { AuthHttpClient } from './client';
import {
  verifyRegistrationHttpLimits,
  verifyRegistrationHttpRejections,
} from './registration-http-boundaries.scenarios';
import {
  assertGenericRegistration,
  assertPublicAuthError,
  REGISTRATION_HTTP_OPERATIONS as OP,
  publicRecord,
  RegistrationHttpObserver,
  type RegistrationHttpStage,
  reportRegistrationHttpFailure,
  REGISTRATION_HTTP_STAGE as STAGE,
} from './registration-http.support';

/** Exercises running Gateway/Platform commands and returns evidence only after exact owned cleanup. */
export async function verifyRegistrationHttpScenarios(
  cleanup: DataSource,
  environment: EnvironmentVariables,
  original: OwnedAuthFixture,
  password: string,
): Promise<[string, string][]> {
  const fixtures = new OwnedRegistrationFixtures(cleanup);
  const tokens = new OpaqueTokenService(new ConfigService(environment));
  const client = new AuthHttpClient();
  const observer = new RegistrationHttpObserver(client, original.id);
  const completed: [string, string][] = [];
  const originalCapture = new OwnedMailCapture(original.email, EMAIL_CONFIRMATION.SUBJECT);
  let stage: RegistrationHttpStage = STAGE.SESSION;
  let scenarioFailed = false;
  let cleanupFailed = false;

  try {
    const login = await client.graphql(OP.SIGN_IN, { input: { email: original.email, password } });
    assert.equal(login.errors, undefined);
    client.acceptIssuedCookie(login.response);

    stage = STAGE.CAPTURE;
    await originalCapture.assertAvailable();
    const originalState = await cleanup.getRepository(User).findOneByOrFail({ id: original.id });
    const fixture = await fixtures.allocate();
    stage = STAGE.SIGN_UP;
    assertGenericRegistration(await observer.request(OP.SIGN_UP, signupInput(fixture)), 'signUp');
    stage = STAGE.SIGN_UP_STATE;
    const persisted = await cleanup.getRepository(User).findOneByOrFail({ email: fixture.email });
    assert.equal(persisted.emailVerifiedAt, null);
    stage = STAGE.UNVERIFIED_LOGIN;
    const pendingLogin = await new AuthHttpClient().graphql(OP.SIGN_IN, {
      input: { email: fixture.email, password: fixture.password },
    });
    assertPublicAuthError(pendingLogin, AUTH_ERROR_CODE.EMAIL_UNVERIFIED);
    stage = STAGE.MAIL;
    const captured = await fixture.capture.readConfirmationTokens(
      1,
      environment.SMTP_FROM,
      environment.WEB_PUBLIC_BASE_URL,
      tokens,
    );
    const firstToken = captured[0];
    assert.ok(firstToken);
    const tokenRows = await cleanup
      .getRepository(EmailVerificationToken)
      .findBy({ userId: persisted.id });
    assert.equal(tokenRows.length, 1);
    assert.equal(tokenRows[0]?.tokenDigest.length, 64);
    assert.equal(tokenRows[0]?.tokenDigest.includes(firstToken), false);
    completed.push([
      'D3-EMAIL-01',
      'generic signup, real owned SMTP capture and unverified login rejection',
    ]);

    stage = STAGE.DUPLICATE;
    assertGenericRegistration(
      await observer.request(OP.SIGN_UP, {
        ...signupInput(fixture),
        displayName: 'Forbidden overwrite',
        password: 'different-password',
      }),
      'signUp',
    );
    const unchanged = await cleanup.getRepository(User).findOneByOrFail({ id: persisted.id });
    assert.equal(unchanged.passwordHash === persisted.passwordHash, true);
    assert.equal(unchanged.displayName === persisted.displayName, true);
    assert.equal(
      await cleanup.getRepository(EmailVerificationToken).countBy({ userId: persisted.id }),
      1,
    );
    assert.equal(
      (
        await fixture.capture.readConfirmationTokens(
          1,
          environment.SMTP_FROM,
          environment.WEB_PUBLIC_BASE_URL,
          tokens,
        )
      ).length,
      1,
    );
    completed.push([
      'D3-EMAIL-02',
      'duplicate signup preserves profile/password and durable cooldown',
    ]);

    // Age only the owned issuance clock to exercise replacement without a real minute-long wait.
    stage = STAGE.REPLACEMENT;
    await cleanup
      .getRepository(EmailVerificationToken)
      .createQueryBuilder()
      .update()
      .set({
        /** Ages only the owned issuance history beyond the configured durable cooldown. */
        createdAt: () =>
          "clock_timestamp() - (:cooldownMs::double precision * interval '1 millisecond')",
      })
      .setParameter('cooldownMs', environment.AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS + 1000)
      .where('user_id = :userId', { userId: persisted.id })
      .execute();
    assertGenericRegistration(
      await observer.request(OP.RESEND, { email: fixture.email }),
      'resendEmailConfirmation',
    );
    const replacements = await fixture.capture.readConfirmationTokens(
      2,
      environment.SMTP_FROM,
      environment.WEB_PUBLIC_BASE_URL,
      tokens,
    );
    const successor = replacements.find(
      /** Distinguishes the replacement privately, independently of capture sort order. */
      (candidate) => candidate !== firstToken,
    );
    assert.ok(successor);
    stage = STAGE.CONFIRMATION;
    assertPublicAuthError(
      await observer.request(OP.CONFIRM, { token: firstToken }),
      AUTH_ERROR_CODE.CONFIRMATION_INVALID,
    );
    assertGenericRegistration(
      await observer.request(OP.CONFIRM, { token: successor }),
      'confirmEmail',
    );
    assertPublicAuthError(
      await observer.request(OP.CONFIRM, { token: successor }),
      AUTH_ERROR_CODE.CONFIRMATION_INVALID,
    );
    completed.push([
      'D3-EMAIL-03',
      'explicit replacement confirmation, replaced/reused rejection, no cookie changes',
    ]);

    const registered = new AuthHttpClient();
    stage = STAGE.VERIFIED_LOGIN;
    assertPublicAuthError(
      await registered.graphql(OP.SIGN_IN, {
        input: { email: fixture.email, password: 'different-password' },
      }),
      AUTH_ERROR_CODE.INVALID_CREDENTIALS,
    );
    const signIn = await registered.graphql(OP.SIGN_IN, {
      input: { email: fixture.email, password: fixture.password },
    });
    assert.equal(signIn.errors, undefined);
    registered.acceptIssuedCookie(signIn.response);
    assert.equal(publicRecord(await registered.graphql(OP.ME), 'me').id, persisted.id);
    assert.equal(publicRecord(await registered.graphql(OP.SIGN_OUT), 'signOut').success, true);
    assertPublicAuthError(await registered.graphql(OP.ME), AUTH_ERROR_CODE.SESSION_INVALID);
    await observer.assertCurrentSession();
    completed.push([
      'D3-EMAIL-04',
      'verified explicit login/logout, original credentials and independent session',
    ]);

    const unknown = await fixtures.allocate();
    stage = STAGE.UNKNOWN_VERIFIED;
    for (let attempt = 0; attempt <= IDENTITY_LIMITS.REGISTRATION_ATTEMPTS; attempt += 1) {
      assertGenericRegistration(
        await observer.request(OP.RESEND, { email: unknown.email }),
        'resendEmailConfirmation',
      );
    }
    assert.equal(await cleanup.getRepository(User).countBy({ email: unknown.email }), 0);
    await unknown.capture.assertEmpty();
    assertGenericRegistration(
      await observer.request(OP.SIGN_UP, {
        displayName: 'Forbidden verified overwrite',
        email: original.email,
        password: 'different-password',
      }),
      'signUp',
    );
    assertGenericRegistration(
      await observer.request(OP.RESEND, { email: original.email }),
      'resendEmailConfirmation',
    );
    assert.equal(
      await cleanup.getRepository(EmailVerificationToken).countBy({ userId: original.id }),
      0,
    );
    const originalAfter = await cleanup.getRepository(User).findOneByOrFail({ id: original.id });
    assert.equal(originalAfter.passwordHash === originalState.passwordHash, true);
    assert.equal(originalAfter.displayName === originalState.displayName, true);
    await originalCapture.assertEmpty();
    completed.push([
      'D3-EMAIL-05',
      'unknown/verified and identity-suppressed requests remain generic',
    ]);

    stage = STAGE.REJECTIONS;
    await verifyRegistrationHttpRejections(cleanup, observer, persisted.id, successor);
    completed.push([
      'D3-EMAIL-06',
      'safe public/private validation, bounded dependency failure, Origin/batch policy',
    ]);
    stage = STAGE.LIMITS;
    await verifyRegistrationHttpLimits(observer, unknown.email);
    completed.push([
      'D3-EMAIL-07',
      'real identity and IP thresholds with cookie/session preservation',
    ]);
  } catch {
    scenarioFailed = true;
    reportRegistrationHttpFailure(stage);
  } finally {
    // The exclusive fixture may have an ambiguous HTTP completion; allow owned SMTP teardown before cleanup.
    /** Waits only the accepted worker/phase bound; no late delivery is declared a passing cleanup. */
    await new Promise<void>((resolve) =>
      setTimeout(resolve, MAIL_LIMITS.DEADLINE_MS + MAIL_LIMITS.PHASE_TIMEOUT_MS),
    );
    try {
      await fixtures.cleanup();
    } catch {
      cleanupFailed = true;
    } finally {
      try {
        await originalCapture.cleanup();
        await originalCapture.assertEmpty();
      } catch {
        cleanupFailed = true;
      }
    }

    if (cleanupFailed) {
      reportRegistrationHttpFailure(STAGE.CLEANUP);
    }
  }

  if (scenarioFailed || cleanupFailed) {
    throw new Error('Registration HTTP verification failed; private details omitted');
  }

  return completed;
}
