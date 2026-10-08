import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { createDispatcher } from '#app/mail/mail.module';
import { MAIL_ADMISSION, MAIL_OUTCOME } from '#app/mail/mail.port';

import type { OwnedAuthFixture } from '../auth-http/fixture';

import { AuthHttpClient } from '../auth-http/client';
import { OwnedMailCapture } from './owned-mail-capture';

/** Proves real delivery, or explicit stopped-Mailpit isolation, using only run-owned state. */
export async function verifyMailScenarios(
  environment: EnvironmentVariables,
  fixture: OwnedAuthFixture,
  password: string,
  outage: boolean,
): Promise<void> {
  if (
    environment.SMTP_HOST !== 'mailpit' ||
    environment.SMTP_PORT !== 1025 ||
    environment.SMTP_SECURE !== 'false' ||
    environment.SMTP_USER !== undefined ||
    environment.SMTP_PASSWORD !== undefined
  ) {
    console.error('D1-MAIL-TARGET refused');

    throw new Error('MAIL-TARGET refused');
  }

  const dispatcher = createDispatcher(new ConfigService(environment));
  const subject = `D1 mail ${fixture.id}`;
  const text = 'D1 local mail transport verification. No confirmation credential is included.';
  const capture = new OwnedMailCapture(fixture.email, subject);
  const client = new AuthHttpClient();
  let captureReady = false;
  let scenarioFailed = false;
  let cleanupFailed = false;
  let stage: 'capture' | 'dispatch' | 'outage-prerequisite' | 'session' = outage
    ? 'outage-prerequisite'
    : 'capture';

  try {
    if (outage) {
      let captureUnavailable = false;

      try {
        await capture.assertAvailable();
      } catch {
        captureUnavailable = true;
      }

      if (!captureUnavailable) {
        throw new Error('MAIL-OUTAGE prerequisite');
      }
    } else {
      await capture.assertAvailable();
      captureReady = true;
    }

    stage = 'session';
    const login = await client.graphql(
      'mutation MailSignIn($input: SignInInput!) { signIn(input: $input) { user { id } } }',
      { input: { email: fixture.email, password } },
    );

    if (login.errors?.length) {
      throw new Error('MAIL-SESSION login');
    }

    client.acceptIssuedCookie(login.response);

    await verifySession(client, fixture);

    stage = 'dispatch';
    const receipt = dispatcher.enqueue({ subject, text, to: fixture.email });

    if (receipt.admission !== MAIL_ADMISSION.QUEUED || !receipt.completion) {
      throw new Error('MAIL-DISPATCH admission');
    }

    const outcome = await receipt.completion;

    if (outage) {
      if (outcome !== MAIL_OUTCOME.SMTP_FAILED && outcome !== MAIL_OUTCOME.TIMEOUT) {
        throw new Error('MAIL-OUTAGE expected-failure');
      }
    } else {
      if (outcome !== MAIL_OUTCOME.SENT) {
        throw new Error('MAIL-DISPATCH failed');
      }

      stage = 'capture';

      await capture.verifyText(text, environment.SMTP_FROM);
    }

    stage = 'session';

    await verifySession(client, fixture);
  } catch {
    scenarioFailed = true;

    console.error(`D1-MAIL-${stage} failed`);
  } finally {
    try {
      dispatcher.onApplicationShutdown();
    } catch {
      cleanupFailed = true;

      console.error('D1-MAIL-shutdown failed');
    }

    if (captureReady) {
      try {
        await capture.cleanup();
      } catch {
        cleanupFailed = true;

        console.error('D1-MAIL-cleanup failed');
      }
    }
  }

  if (scenarioFailed || cleanupFailed) {
    const failure = scenarioFailed
      ? cleanupFailed
        ? 'Mail verification and cleanup failed'
        : 'Mail verification failed'
      : 'Mail cleanup failed';

    throw new Error(`${failure}; private diagnostics omitted`);
  }

  console.log(outage ? 'D1-MAIL-SESSION-12 passed' : 'D1-MAIL-CAPTURE passed');
}

/** Checks one fixture's existing session and protected inbox without logging response data. */
async function verifySession(client: AuthHttpClient, fixture: OwnedAuthFixture): Promise<void> {
  const response = await client.graphql(
    'query MailSession { me { id } correctionSessions { id } }',
  );
  const me = response.data?.me;

  if (
    response.errors?.length ||
    !me ||
    typeof me !== 'object' ||
    !('id' in me) ||
    me.id !== fixture.id ||
    !Array.isArray(response.data?.correctionSessions) ||
    response.response.headers.has('set-cookie')
  ) {
    throw new Error('MAIL-SESSION failed');
  }

  const readiness = await fetch('http://platform-service:8083/internal/v1/readiness', {
    redirect: 'error',
    signal: AbortSignal.timeout(2000),
  });

  await readiness.body?.cancel();

  if (!readiness.ok) {
    throw new Error('MAIL-READINESS failed');
  }
}
