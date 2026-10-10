import type {
  PlatformConfirmEmailResponse,
  PlatformPendingSignUpResponse,
  PlatformResendEmailConfirmationResponse,
} from '@aspectloop/contracts/platform';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MAIL_DISPATCHER, type MailDispatcher } from '#app/mail/mail.port';

import type { RegistrationMailWork } from './registration.types';

import { PasswordService } from '../credentials/password.service';
import { AuthIdentityLimiter } from '../limits/auth-identity-limiter';
import { createConfirmationMessage } from './registration.message';
import { RegistrationStore } from './registration.store';
import {
  parseRegistrationConfirmation,
  parseRegistrationResend,
  parseRegistrationSignUp,
} from './registration.validation';

/** Prepared registration commands; D3 owns HTTP activation, not this provider. */
@Injectable()
export class RegistrationService {
  private readonly webBaseUrl: string;

  /** Consumes the accepted D1 mail port without waiting for recipient-specific delivery. */
  constructor(
    private readonly store: RegistrationStore,
    private readonly passwords: PasswordService,
    private readonly limiter: AuthIdentityLimiter,
    config: ConfigService,
    @Inject(MAIL_DISPATCHER) private readonly mail: MailDispatcher,
  ) {
    this.webBaseUrl = config.getOrThrow<string>('WEB_PUBLIC_BASE_URL');
  }

  /** Maps invalid strings uniformly before crypto/SQL while keeping structural rejection separate. */
  async confirm(input: unknown): Promise<PlatformConfirmEmailResponse> {
    const parsed = parseRegistrationConfirmation(input);
    await this.store.confirm(parsed.token);
    return { success: true };
  }

  /** Shares signup's request budget and durable cooldown without exposing existence or mail admission. */
  async resend(input: unknown): Promise<PlatformResendEmailConfirmationResponse> {
    const parsed = parseRegistrationResend(input);

    if (!this.limiter.admitRegistration(parsed.email)) {
      return { success: true };
    }

    const work = await this.store.resend(parsed.email);
    this.enqueueCommitted(work);
    return { success: true };
  }

  /** Validates cheap input before admission/hash; duplicates and suppression remain generic. */
  async signUp(input: unknown): Promise<PlatformPendingSignUpResponse> {
    const parsed = parseRegistrationSignUp(input);

    if (!this.limiter.admitRegistration(parsed.email)) {
      return { success: true };
    }

    const passwordHash = await this.passwords.hash(parsed.password);
    const work = await this.store.signUp({
      displayName: parsed.displayName,
      email: parsed.email,
      passwordHash,
    });
    this.enqueueCommitted(work);
    return { success: true };
  }

  /** Enqueues only returned committed work; dispatcher receipts never alter token/cooldown state. */
  private enqueueCommitted(work: null | RegistrationMailWork): void {
    if (work) {
      this.mail.enqueue(createConfirmationMessage(this.webBaseUrl, work));
    }
  }
}
