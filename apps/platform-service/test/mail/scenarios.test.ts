import { EnvironmentVariables } from '@platform/config/env.schema';
import { AuthHttpClient } from '@platform/db/verify/auth-http/client';
import { OwnedMailCapture } from '@platform/db/verify/mail/owned-mail-capture';
import { verifyMailScenarios } from '@platform/db/verify/mail/scenarios';
import { BoundedMailDispatcher } from '@platform/mail/dispatch/bounded-mail-dispatcher';
import { createDispatcher } from '@platform/mail/mail.module';
import { MAIL_ADMISSION, MAIL_OUTCOME, type MailTransport } from '@platform/mail/mail.port';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

/** Replaces runtime wiring only; verification still exercises its real failure/cleanup ordering. */
vi.mock('@platform/mail/mail.module', () => ({ createDispatcher: vi.fn() }));

const ID = '00000000-0000-4000-8000-000000000001';
const FIXTURE = { email: `auth-http-${ID}@example.test`, id: ID };
const environment = Object.assign(new EnvironmentVariables(), {
  SMTP_FROM: 'no-reply@example.test',
  SMTP_HOST: 'mailpit',
  SMTP_PORT: 1025,
  SMTP_SECURE: 'false',
});
let dispatcher: BoundedMailDispatcher;

/** Restores all test-owned provider boundaries and global console/network spies. */
function cleanup(): void {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

/** Supplies successful private fixture evidence without opening SMTP, HTTP, or database connections. */
function prepare(): void {
  const transport: MailTransport = { start: vi.fn<MailTransport['start']>() };
  dispatcher = new BoundedMailDispatcher(transport);

  vi.mocked(createDispatcher).mockReturnValue(dispatcher);
  vi.spyOn(dispatcher, 'enqueue').mockReturnValue({
    admission: MAIL_ADMISSION.QUEUED,
    completion: Promise.resolve(MAIL_OUTCOME.SENT),
  });
  vi.spyOn(OwnedMailCapture.prototype, 'assertAvailable').mockResolvedValue();
  vi.spyOn(OwnedMailCapture.prototype, 'verifyText').mockResolvedValue();
  vi.spyOn(OwnedMailCapture.prototype, 'cleanup').mockResolvedValue();
  vi.spyOn(AuthHttpClient.prototype, 'graphql').mockResolvedValue({
    data: { correctionSessions: [], me: { id: ID } },
    response: new Response(null),
  });
  /** Isolates cookie parsing, which is outside verification-cleanup coverage. */
  vi.spyOn(AuthHttpClient.prototype, 'acceptIssuedCookie').mockImplementation(() => {
    // The fixture's HTTP evidence is supplied entirely by the test-owned client double.
  });

  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(null)));
  vi.spyOn(console, 'error').mockImplementation(vi.fn());
  vi.spyOn(console, 'log').mockImplementation(vi.fn());
}

/** Does not print success before cleanup, even if SMTP and session evidence succeeded. */
async function testCleanupFailure(): Promise<void> {
  vi.mocked(OwnedMailCapture.prototype.cleanup).mockRejectedValueOnce(new Error('PRIVATE-CAPTURE'));

  await expect(
    verifyMailScenarios(environment, FIXTURE, 'fixture-password', false),
  ).rejects.toThrow('Mail cleanup failed; private diagnostics omitted');

  expect(console.error).toHaveBeenCalledExactlyOnceWith('D1-MAIL-cleanup failed');
  expect(console.log).not.toHaveBeenCalled();
}

/** Reports both fixed failure categories without replacing the primary failure or exposing causes. */
async function testCombinedFailure(): Promise<void> {
  vi.mocked(AuthHttpClient.prototype.graphql).mockRejectedValueOnce(new Error('PRIVATE-LOGIN'));
  vi.mocked(OwnedMailCapture.prototype.cleanup).mockRejectedValueOnce(new Error('PRIVATE-CAPTURE'));

  await expect(
    verifyMailScenarios(environment, FIXTURE, 'fixture-password', false),
  ).rejects.toThrow('Mail verification and cleanup failed; private diagnostics omitted');

  expect(console.error).toHaveBeenNthCalledWith(1, 'D1-MAIL-session failed');
  expect(console.error).toHaveBeenNthCalledWith(2, 'D1-MAIL-cleanup failed');
  expect(console.error).toHaveBeenCalledTimes(2);
  expect(console.log).not.toHaveBeenCalled();
}

/** Preserves the sanitized scenario failure after successful capture cleanup. */
async function testScenarioFailure(): Promise<void> {
  vi.mocked(AuthHttpClient.prototype.graphql).mockRejectedValueOnce(new Error('PRIVATE-LOGIN'));

  await expect(
    verifyMailScenarios(environment, FIXTURE, 'fixture-password', false),
  ).rejects.toThrow('Mail verification failed; private diagnostics omitted');

  expect(OwnedMailCapture.prototype.cleanup).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalledExactlyOnceWith('D1-MAIL-session failed');
  expect(console.log).not.toHaveBeenCalled();
}

/** Still attempts owned capture cleanup when dispatcher shutdown unexpectedly fails. */
async function testShutdownFailure(): Promise<void> {
  /** Models a lifecycle defect without forwarding its private details. */
  vi.spyOn(dispatcher, 'onApplicationShutdown').mockImplementationOnce(() => {
    throw new Error('PRIVATE-SHUTDOWN');
  });

  await expect(
    verifyMailScenarios(environment, FIXTURE, 'fixture-password', false),
  ).rejects.toThrow('Mail cleanup failed; private diagnostics omitted');

  expect(OwnedMailCapture.prototype.cleanup).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalledExactlyOnceWith('D1-MAIL-shutdown failed');
  expect(console.log).not.toHaveBeenCalled();
}

/** Prints the positive evidence only after every cleanup step has completed successfully. */
async function testSuccessAfterCleanup(): Promise<void> {
  await verifyMailScenarios(environment, FIXTURE, 'fixture-password', false);

  expect(OwnedMailCapture.prototype.cleanup).toHaveBeenCalledOnce();
  expect(console.error).not.toHaveBeenCalled();
  expect(console.log).toHaveBeenCalledExactlyOnceWith('D1-MAIL-CAPTURE passed');
  expect(vi.mocked(OwnedMailCapture.prototype.cleanup).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(console.log).mock.invocationCallOrder[0]!,
  );
}

beforeEach(prepare);
afterEach(cleanup);
test('preserves the scenario failure after cleanup', testScenarioFailure);
test('retains scenario and cleanup failures without private causes', testCombinedFailure);
test('does not report passed when capture cleanup fails', testCleanupFailure);
test('attempts capture cleanup even when shutdown fails', testShutdownFailure);
test('reports passed only after cleanup succeeds', testSuccessAfterCleanup);
