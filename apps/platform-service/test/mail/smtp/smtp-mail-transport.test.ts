import { MAIL_OUTCOME } from '@platform/mail/mail.port';
import { SmtpMailTransport } from '@platform/mail/smtp/smtp-mail-transport';
import { EventEmitter } from 'node:events';
import { createConnection, type Socket } from 'node:net';
import { PassThrough } from 'node:stream';
import { connect as connectTls } from 'node:tls';
import MailComposer from 'nodemailer/lib/mail-composer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

/** Replaces only socket creation; the adapter still owns cancellation through the public port. */
vi.mock('node:net', async () => {
  const actual = await vi.importActual<typeof import('node:net')>('node:net');

  return { ...actual, createConnection: vi.fn() };
});

/** Isolates implicit TLS creation without allowing any external network request. */
vi.mock('node:tls', async () => {
  const actual = await vi.importActual<typeof import('node:tls')>('node:tls');

  return { ...actual, connect: vi.fn() };
});

/** Supplies a typed mock constructor for the installed public SMTP connection export. */
vi.mock('nodemailer/lib/smtp-connection', () => ({ default: vi.fn() }));

/** Supplies a typed mock constructor for the installed public MIME composer export. */
vi.mock('nodemailer/lib/mail-composer', () => ({ default: vi.fn() }));

class ControlledConnection extends EventEmitter {
  readonly close = vi.fn();
  readonly connect = vi.fn();
  readonly login = vi.fn();
  readonly send = vi.fn();
}

class OwnedSocket extends EventEmitter {
  readonly destroy = vi.fn();
}

let socket: OwnedSocket;
let connection: ControlledConnection;
let stream: PassThrough;
const MESSAGE = { subject: 'Fixture', text: 'PRIVATE-TEXT', to: 'fixture@example.test' };
const SETTINGS = { from: 'no-reply@example.test', host: 'mailpit', port: 1025, secure: false };

/** Drops only test-owned provider listeners and fake timers. */
function cleanup(): void {
  stream.destroy();
  socket.removeAllListeners();
  connection.removeAllListeners();

  vi.useRealTimers();
}

/** Installs isolated provider handles with deterministic callbacks and timers. */
function prepare(): void {
  vi.useFakeTimers();
  vi.clearAllMocks();
  socket = new OwnedSocket();
  connection = new ControlledConnection();
  stream = new PassThrough();

  vi.mocked(createConnection).mockReturnValue(socket as unknown as Socket);
  vi.mocked(connectTls).mockReturnValue(socket as unknown as ReturnType<typeof connectTls>);
  /** Returns the controllable connection without performing SMTP mechanics. */
  vi.mocked(SMTPConnection).mockImplementation(function createConnectionFixture() {
    return connection as unknown as SMTPConnection;
  });
  /** Returns one bounded message stream without MIME-generation timers. */
  vi.mocked(MailComposer).mockImplementation(function createComposerFixture() {
    return {
      /** Supplies the minimal public compiled-message operations used by the adapter. */
      compile() {
        return {
          /** Supplies an owned stream that cancellation must destroy. */
          createReadStream: () => stream,
          /** Exposes only the fixed envelope that a provider would send. */
          getEnvelope: () => ({ from: SETTINGS.from, to: [MESSAGE.to] }),
        };
      },
    } as unknown as MailComposer;
  });
}

/** Proves a stalled active DATA send loses both stream and socket, not only its promise. */
async function testActiveCancellation(): Promise<void> {
  const attempt = new SmtpMailTransport(SETTINGS).start(MESSAGE);

  socket.emit('connect');

  const ready = connection.connect.mock.calls[0]?.[0] as () => void;

  ready();
  attempt.cancel();

  expect(await attempt.result).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(connection.send).toHaveBeenCalledOnce();
  expect(connection.close).toHaveBeenCalledOnce();
  expect(connection.eventNames()).toEqual([]);
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(stream.destroyed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
}

/** Proves the connection phase is independently bounded inside the overall dispatch budget. */
async function testConnectionTimeout(): Promise<void> {
  const attempt = new SmtpMailTransport(SETTINGS).start(MESSAGE);

  await vi.advanceTimersByTimeAsync(1500);

  expect(await attempt.result).toBe(MAIL_OUTCOME.TIMEOUT);
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
}

/** Proves cancellation during connection setup destroys the socket and cannot reconnect. */
async function testEarlyCancellation(): Promise<void> {
  const attempt = new SmtpMailTransport(SETTINGS).start(MESSAGE);

  attempt.cancel();
  attempt.cancel();

  socket.emit('connect');

  expect(await attempt.result).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(SMTPConnection).not.toHaveBeenCalled();
  expect(socket.listenerCount('connect')).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
}

/** Requires the implicit-TLS event before starting SMTP, without disabling certificate checks. */
async function testImplicitTls(): Promise<void> {
  const attempt = new SmtpMailTransport({
    ...SETTINGS,
    host: 'smtp.example.test',
    port: 465,
    secure: true,
  }).start(MESSAGE);

  socket.emit('connect');

  expect(SMTPConnection).not.toHaveBeenCalled();

  socket.emit('secureConnect');

  expect(connectTls).toHaveBeenCalledWith({
    host: 'smtp.example.test',
    port: 465,
    servername: 'smtp.example.test',
  });
  expect(SMTPConnection).toHaveBeenCalledWith(
    expect.objectContaining({ secure: true, secured: true }),
  );

  attempt.cancel();

  expect(await attempt.result).toBe(MAIL_OUTCOME.SMTP_FAILED);
}

/** Rejects MIME's false sender at the SMTP boundary without a cast or network submission. */
async function testInvalidEnvelope(): Promise<void> {
  /** Models the wider MIME envelope type using the installed composer's public shape. */
  vi.mocked(MailComposer).mockImplementationOnce(function createInvalidComposerFixture() {
    return {
      /** Produces an invalid envelope without creating a message stream. */
      compile() {
        return {
          /** Supplies an owned stream only if the adapter incorrectly accepts the envelope. */
          createReadStream: () => stream,
          /** Models the null-sender value that SMTP's narrower declaration excludes. */
          getEnvelope: () => ({ from: false, to: [MESSAGE.to] }),
        };
      },
    } as unknown as MailComposer;
  });
  const attempt = new SmtpMailTransport(SETTINGS).start(MESSAGE);

  socket.emit('connect');

  const ready = connection.connect.mock.calls[0]?.[0] as () => void;

  ready();

  expect(await attempt.result).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(connection.send).not.toHaveBeenCalled();
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
}

/** Ensures a delayed authentication acknowledgement cannot submit mail after physical cancellation. */
async function testLateAuthentication(): Promise<void> {
  const attempt = new SmtpMailTransport({
    ...SETTINGS,
    password: 'PRIVATE-PASSWORD',
    user: 'user',
  }).start(MESSAGE);

  socket.emit('connect');

  const ready = connection.connect.mock.calls[0]?.[0] as () => void;

  ready();

  const authenticated = connection.login.mock.calls[0]?.[1] as (error: Error | null) => void;

  attempt.cancel();
  authenticated(null);

  expect(await attempt.result).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(connection.send).not.toHaveBeenCalled();
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
}

/** Preserves acknowledged submission while consuming only late teardown errors until close. */
async function testLateTeardownErrors(): Promise<void> {
  const attempt = new SmtpMailTransport(SETTINGS).start(MESSAGE);

  socket.emit('connect');

  const ready = connection.connect.mock.calls[0]?.[0] as () => void;

  ready();

  const complete = connection.send.mock.calls[0]?.[2] as (error: Error | null) => void;

  complete(null);
  socket.emit('error', new Error('PRIVATE-LATE-SOCKET'));
  stream.emit('error', new Error('PRIVATE-LATE-STREAM'));
  socket.emit('close');
  stream.emit('close');

  expect(await attempt.result).toBe(MAIL_OUTCOME.SENT);
  expect(socket.listenerCount('error')).toBe(0);
  expect(stream.listenerCount('error')).toBe(0);
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(connection.close).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
}

/** Proves even a provider-close exception cannot retain an adapter-owned socket. */
async function testProviderTeardownFailure(): Promise<void> {
  const attempt = new SmtpMailTransport(SETTINGS).start(MESSAGE);

  socket.emit('connect');

  /** Models a provider teardown exception that must never reach logs or the receipt. */
  connection.close.mockImplementationOnce(() => {
    throw new Error('PRIVATE-CLOSE-FAILURE');
  });

  attempt.cancel();

  expect(await attempt.result).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
}

/** Ensures paired credentials demand STARTTLS and are not submitted before handshake. */
async function testRequiredTlsAuthentication(): Promise<void> {
  const attempt = new SmtpMailTransport({
    ...SETTINGS,
    password: 'PRIVATE-PASSWORD',
    user: 'user',
  }).start(MESSAGE);

  socket.emit('connect');

  expect(connection.login).not.toHaveBeenCalled();
  expect(SMTPConnection).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true }));
  const ready = connection.connect.mock.calls[0]?.[0] as () => void;

  ready();

  const authenticated = connection.login.mock.calls[0]?.[1] as (error: Error | null) => void;

  authenticated(new Error('PRIVATE-AUTH-REPLY'));

  expect(await attempt.result).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(connection.send).not.toHaveBeenCalled();
  expect(socket.destroy).toHaveBeenCalledOnce();
}

/** Proves successful submission disables raw logging/file/URL input and settles exactly once. */
async function testSuccess(): Promise<void> {
  const attempt = new SmtpMailTransport(SETTINGS).start(MESSAGE);

  socket.emit('connect');

  const ready = connection.connect.mock.calls[0]?.[0] as () => void;

  ready();

  const complete = connection.send.mock.calls[0]?.[2] as (error: Error | null) => void;

  complete(null);
  complete(new Error('PRIVATE-SMTP-DIAGNOSTIC'));
  attempt.cancel();

  expect(await attempt.result).toBe(MAIL_OUTCOME.SENT);
  expect(connection.send.mock.calls[0]?.[0]).toEqual({ from: SETTINGS.from, to: [MESSAGE.to] });
  expect(MailComposer).toHaveBeenCalledWith(
    expect.objectContaining({ disableFileAccess: true, disableUrlAccess: true }),
  );
  expect(SMTPConnection).toHaveBeenCalledWith(
    expect.objectContaining({
      connection: socket,
      debug: false,
      logger: false,
      socketTimeout: 1500,
      transactionLog: false,
    }),
  );
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(stream.destroyed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
}

beforeEach(prepare);
afterEach(cleanup);
test('cancels connection setup and ignores late connect', testEarlyCancellation);
test('bounds the connection phase', testConnectionTimeout);
test('physically cancels an active SMTP DATA attempt', testActiveCancellation);
test('strips provider diagnostics and disables risky MIME inputs', testSuccess);
test('requires TLS before authenticating SMTP credentials', testRequiredTlsAuthentication);
test('waits for implicit TLS and retains certificate validation', testImplicitTls);
test('destroys owned resources even when provider teardown throws', testProviderTeardownFailure);
test('rejects an invalid MIME sender before SMTP submission', testInvalidEnvelope);
test('ignores late authentication success after cancellation', testLateAuthentication);
test('consumes late teardown errors without changing submission outcome', testLateTeardownErrors);
