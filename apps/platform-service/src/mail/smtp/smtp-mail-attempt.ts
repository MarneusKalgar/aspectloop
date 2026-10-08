import { createConnection, isIP } from 'node:net';
import { connect as connectTls } from 'node:tls';
import SMTPConnection from 'nodemailer/lib/smtp-connection';

import type { SmtpMailSettings } from './smtp-mail-transport';

import {
  MAIL_LIMITS,
  MAIL_OUTCOME,
  type MailAttempt,
  type MailAttemptOutcome,
  type MailMessage,
} from '../mail.port';
import { type CompiledMail, compileSmtpMessage, smtpEnvelope } from './smtp-message';
import { SmtpOwnedResources } from './smtp-owned-resources';
import { SMTP_LIMITS } from './smtp.constants';

/** Coordinates one SMTP transaction; its resource owner controls handles and teardown. */
export class SmtpMailAttempt implements MailAttempt {
  readonly result: Promise<MailAttemptOutcome>;
  private compiled: CompiledMail | null;
  private readonly onAuthenticated: (error: unknown) => void;
  private readonly onConnected: () => void;
  private readonly onFailure: (error?: unknown) => void;
  private readonly onReady: () => void;
  private readonly onSubmitted: (error: unknown) => void;
  private readonly onTimeout: () => void;
  private phaseTimer: null | ReturnType<typeof setTimeout> = null;
  private resolveResult!: (outcome: MailAttemptOutcome) => void;
  private readonly resources: SmtpOwnedResources;
  private settled = false;

  /** Compiles a private snapshot and binds ordinary callback methods once for stable identity. */
  constructor(
    private readonly settings: SmtpMailSettings,
    message: MailMessage,
  ) {
    this.onAuthenticated = this.authenticated.bind(this);
    this.onConnected = this.connected.bind(this);
    this.onFailure = this.fail.bind(this);
    this.onReady = this.ready.bind(this);
    this.onSubmitted = this.submitted.bind(this);
    this.onTimeout = this.timedOut.bind(this);
    this.resources = new SmtpOwnedResources(this.onConnected, this.onFailure);
    this.compiled = compileSmtpMessage(settings.from, message);
    this.result = new Promise<MailAttemptOutcome>(
      /** Retains only the resolver needed for exactly-once settlement. */
      (resolve) => {
        this.resolveResult = resolve;
      },
    );
  }

  /** Idempotently destroys this attempt; the dispatcher owns its overall timeout category. */
  cancel(): void {
    this.fail();
  }

  /** Opens an owned socket and bounds DNS/TLS before SMTP takes over. */
  start(): void {
    if (this.settled || this.resources.socket) {
      return;
    }

    try {
      const options = { host: this.settings.host, port: this.settings.port };
      const socket = this.settings.secure
        ? connectTls({
            ...options,
            servername: isIP(this.settings.host) ? undefined : this.settings.host,
          })
        : createConnection(options);

      this.resources.attachSocket(socket, this.settings.secure);

      this.phaseTimer = setTimeout(this.onTimeout, MAIL_LIMITS.PHASE_TIMEOUT_MS);
    } catch {
      this.fail();
    }
  }

  /** Drops raw authentication replies and ignores acknowledgements after cancellation. */
  private authenticated(error: unknown): void {
    if (error) {
      this.fail(error);
    } else {
      this.send();
    }
  }

  /** Supplies the borrowed open socket to Nodemailer without a hidden pool. */
  private connected(): void {
    const socket = this.resources.socket;

    if (this.settled || !socket) {
      return;
    }

    if (this.phaseTimer !== null) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    try {
      const connection = new SMTPConnection({
        connection: socket,
        connectionTimeout: MAIL_LIMITS.PHASE_TIMEOUT_MS,
        debug: false,
        dnsTimeout: MAIL_LIMITS.PHASE_TIMEOUT_MS,
        greetingTimeout: MAIL_LIMITS.PHASE_TIMEOUT_MS,
        host: this.settings.host,
        logger: false,
        maxResponseSize: SMTP_LIMITS.RESPONSE_BYTES,
        port: this.settings.port,
        requireTLS: Boolean(this.settings.user),
        secure: this.settings.secure,
        secured: this.settings.secure,
        socketTimeout: MAIL_LIMITS.PHASE_TIMEOUT_MS,
        transactionLog: false,
      });

      this.resources.attachConnection(connection);

      connection.connect(this.onReady);
    } catch {
      this.fail();
    }
  }

  /** Omits provider details and guards callbacks after physical cancellation. */
  private fail(error?: unknown): void {
    const timedOut =
      error !== null && typeof error === 'object' && 'code' in error && error.code === 'ETIMEDOUT';

    this.finish(timedOut ? MAIL_OUTCOME.TIMEOUT : MAIL_OUTCOME.SMTP_FAILED);
  }

  /** Clears content and deadline before delegating idempotent physical teardown. */
  private finish(outcome: MailAttemptOutcome): void {
    if (this.settled) {
      return;
    }

    this.settled = true;

    if (this.phaseTimer !== null) {
      clearTimeout(this.phaseTimer);
    }

    this.phaseTimer = null;
    this.compiled = null;

    try {
      this.resources.dispose();
    } finally {
      this.resolveResult(outcome);
    }
  }

  /** Authenticates only after implicit TLS or required STARTTLS has completed. */
  private ready(): void {
    const connection = this.resources.connection;

    if (this.settled || !connection) {
      return;
    }

    try {
      if (this.settings.user && this.settings.password) {
        connection.login(
          { pass: this.settings.password, user: this.settings.user },
          this.onAuthenticated,
        );
      } else {
        this.send();
      }
    } catch {
      this.fail();
    }
  }

  /** Sends one validated envelope and bounded MIME stream after handshake/authentication. */
  private send(): void {
    const connection = this.resources.connection;

    if (this.settled || !connection || !this.compiled) {
      return;
    }

    try {
      const envelope = smtpEnvelope(this.compiled);
      const stream = this.compiled.createReadStream();
      this.compiled = null;

      this.resources.attachStream(stream);

      connection.send(envelope, stream, this.onSubmitted);
    } catch {
      this.fail();
    }
  }

  /** Reduces recipient-specific SMTP results to one fixed category, even for late callbacks. */
  private submitted(error: unknown): void {
    if (error) {
      this.fail(error);
    } else {
      this.finish(MAIL_OUTCOME.SENT);
    }
  }

  /** Physically closes a connection that never reaches SMTP handshake. */
  private timedOut(): void {
    this.finish(MAIL_OUTCOME.TIMEOUT);
  }
}
