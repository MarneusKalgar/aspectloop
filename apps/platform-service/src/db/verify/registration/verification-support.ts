import type { DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

import type { EnvironmentVariables } from '#app/config/env.schema';

import { AuthService } from '#app/auth/auth.service';
import { OpaqueTokenService } from '#app/auth/credentials/opaque-token.service';
import { PasswordService } from '#app/auth/credentials/password.service';
import { AuthIdentityLimiter } from '#app/auth/limits/auth-identity-limiter';
import { EMAIL_CONFIRMATION } from '#app/auth/registration/registration.constants';
import { RegistrationService } from '#app/auth/registration/registration.service';
import { RegistrationStore } from '#app/auth/registration/registration.store';
import { AuthSessionStore } from '#app/auth/sessions/auth-session.store';
import { createDispatcher } from '#app/mail/mail.module';
import {
  MAIL_ADMISSION,
  MAIL_LIMITS,
  MAIL_OUTCOME,
  type MailDispatcher,
  type MailMessage,
  type MailReceipt,
} from '#app/mail/mail.port';
import { User } from '#app/users/user.entity';
import { UsersService } from '#app/users/users.service';

import {
  assertCompletesWithin,
  createVerificationDataSource,
} from '../auth-sessions/verification-support';
import { OwnedMailCapture } from '../mail/owned-mail-capture';

const VERIFICATION_LIMITS = Object.freeze({ FIXTURES: 40, RECEIPTS: 100 });

export interface OwnedRegistrationFixture {
  capture: OwnedMailCapture;
  email: string;
  password: string;
}

export interface RegistrationClient {
  auth: AuthService;
  dataSource: DataSource;
  limiter: AuthIdentityLimiter;
  registration: RegistrationService;
  sessions: AuthSessionStore;
  store: RegistrationStore;
  tokens: OpaqueTokenService;
}

/** Tracks ownership before a command, so post-commit response/capture failures still have exact cleanup. */
export class OwnedRegistrationFixtures {
  private readonly fixtures: OwnedRegistrationFixture[] = [];

  /** Uses the migrator solely for exact owned setup/cleanup, not runtime commands. */
  constructor(private readonly cleanupDatabase: DataSource) {}

  /** Registers a unique absent recipient and verifies capture before submitting any prepared command. */
  async allocate(): Promise<OwnedRegistrationFixture> {
    if (this.fixtures.length >= VERIFICATION_LIMITS.FIXTURES) {
      throw new Error('Registration verification fixture bound');
    }

    const email = `auth-http-${randomUUID()}@example.test`;
    assert.equal(await this.cleanupDatabase.getRepository(User).countBy({ email }), 0);
    const fixture = {
      capture: new OwnedMailCapture(email, EMAIL_CONFIRMATION.SUBJECT),
      email,
      password: randomBytes(24).toString('base64url'),
    };
    this.fixtures.push(fixture);
    await fixture.capture.assertAvailable();
    return fixture;
  }

  /** Discovers actual persisted IDs privately and removes only matching pre-registered recipients. */
  async cleanup(): Promise<void> {
    let failed = false;

    for (const fixture of this.fixtures) {
      try {
        await fixture.capture.cleanup();
        await fixture.capture.assertEmpty();
      } catch {
        failed = true;
      }

      try {
        const user = await this.cleanupDatabase
          .getRepository(User)
          .findOneBy({ email: fixture.email });

        if (user) {
          await this.cleanupDatabase
            .getRepository(User)
            .delete({ email: fixture.email, id: user.id });
        }

        assert.equal(
          await this.cleanupDatabase.getRepository(User).countBy({ email: fixture.email }),
          0,
        );
      } catch {
        failed = true;
      }
    }

    this.fixtures.length = 0;

    if (failed) {
      throw new Error('Registration verification cleanup failed; private details omitted');
    }
  }
}

/** Records private receipts only; production commands never await SMTP completion. */
export class VerificationMail implements MailDispatcher {
  private readonly receipts: MailReceipt[] = [];

  /** Owns one real D1 dispatcher for the explicit local verification run. */
  constructor(private readonly dispatcher: ReturnType<typeof createDispatcher>) {}

  /** Verifies real delivery only in the private harness and drains every observed receipt. */
  async drain(): Promise<void> {
    const receipts = this.receipts.splice(0);
    await assertCompletesWithin(
      Promise.all(
        receipts.map(
          /** Checks each receipt without exposing payloads or transport diagnostics. */
          async (receipt) => {
            assert.equal(receipt.admission, MAIL_ADMISSION.QUEUED);
            assert.equal(await receipt.completion, MAIL_OUTCOME.SENT);
          },
        ),
      ).then(
        /** Completes only after all private delivery assertions have resolved. */
        () => undefined,
      ),
      (Math.ceil(receipts.length / MAIL_LIMITS.ACTIVE) + 1) * MAIL_LIMITS.DEADLINE_MS,
    );
  }

  /** Delegates production admission while retaining only bounded completion receipts, not message bodies. */
  enqueue(message: MailMessage): MailReceipt {
    if (this.receipts.length >= VERIFICATION_LIMITS.RECEIPTS) {
      throw new Error('Registration verification mail bound');
    }

    const receipt = this.dispatcher.enqueue(message);
    this.receipts.push(receipt);
    return receipt;
  }

  /** Physically cancels all remaining SMTP work before cleanup can remove owned messages. */
  shutdown(): void {
    this.dispatcher.onApplicationShutdown();
  }
}

/** Refuses external or authenticated SMTP before any private registration fixture can send mail. */
export function assertLocalRegistrationMail(environment: EnvironmentVariables): void {
  if (
    environment.SMTP_HOST !== 'mailpit' ||
    environment.SMTP_PORT !== 1025 ||
    environment.SMTP_SECURE !== 'false' ||
    environment.SMTP_USER !== undefined ||
    environment.SMTP_PASSWORD !== undefined
  ) {
    throw new Error('Registration verification requires private local Mailpit');
  }
}

/** Reads captured tokens only after delivery; link contents stay entirely inside this process. */
export async function capturedTokens(
  fixture: OwnedRegistrationFixture,
  count: number,
  client: RegistrationClient,
  mail: VerificationMail,
  environment: EnvironmentVariables,
): Promise<string[]> {
  await mail.drain();
  return fixture.capture.readConfirmationTokens(
    count,
    environment.SMTP_FROM,
    environment.WEB_PUBLIC_BASE_URL,
    client.tokens,
  );
}

/** Instantiates production command/session providers using one runtime-role connection pool. */
export function createRegistrationClient(
  environment: EnvironmentVariables,
  mail: MailDispatcher,
  tokens = new OpaqueTokenService(new ConfigService(environment)),
  limiter = new AuthIdentityLimiter(),
): RegistrationClient {
  const config = new ConfigService(environment);
  const dataSource = createVerificationDataSource(environment.DATABASE_URL, environment, 2);
  const passwords = new PasswordService(config);
  const store = new RegistrationStore(dataSource, config, tokens);
  const sessions = new AuthSessionStore(dataSource, config, tokens);

  return {
    auth: new AuthService(
      sessions,
      passwords,
      new UsersService(dataSource.getRepository(User)),
      limiter,
    ),
    dataSource,
    limiter,
    registration: new RegistrationService(store, passwords, limiter, config, mail),
    sessions,
    store,
    tokens,
  };
}

/** Creates the accepted D1 dispatcher; SMTP is confined to private local Mailpit in this tool. */
export function createVerificationMail(environment: EnvironmentVariables): VerificationMail {
  assertLocalRegistrationMail(environment);
  return new VerificationMail(createDispatcher(new ConfigService(environment)));
}

/** Converts only the private fixture into the prepared signup input; caller may supply a competing profile. */
export function signupInput(
  fixture: OwnedRegistrationFixture,
  displayName = 'Registration verification fixture',
) {
  return { displayName, email: fixture.email, password: fixture.password };
}
