import { ConfigService } from '@nestjs/config';
import { OpaqueTokenService } from '@platform/auth/credentials/opaque-token.service';
import { EMAIL_CONFIRMATION } from '@platform/auth/registration/registration.constants';
import { createConfirmationMessage } from '@platform/auth/registration/registration.message';
import { OwnedMailCapture } from '@platform/db/verify/mail/owned-mail-capture';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const ID = '00000000-0000-4000-8000-000000000001';
const RECIPIENT = `auth-http-${ID}@example.test`;
const SUBJECT = `D1 mail ${ID}`;
const CAPTURE_ID = 'run-owned-message';
const OWNED_MESSAGE = {
  ID: CAPTURE_ID,
  Subject: SUBJECT,
  To: [{ Address: RECIPIENT }],
};
const request = vi.fn<typeof fetch>();

/** Restores the process-global request boundary after each owned-capture case. */
function cleanup(): void {
  vi.unstubAllGlobals();
}

/** Installs a fetch double; no test can contact the actual capture service. */
function prepare(): void {
  request.mockReset();

  vi.stubGlobal('fetch', request);
}

/** Produces a private API response without starting a server or exposing real messages. */
function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

/** Makes unavailable capture fail closed without forwarding the provider response body. */
async function testCaptureUnavailable(): Promise<void> {
  request.mockResolvedValueOnce(new Response('PRIVATE-API-DIAGNOSTIC', { status: 503 }));

  await expect(new OwnedMailCapture(RECIPIENT, SUBJECT).assertAvailable()).rejects.toThrow(
    'MAIL-CAPTURE unavailable',
  );

  expect(request).toHaveBeenCalledOnce();
}

/** Captures multiple replacement links privately through fixed API destinations and canonical token parsing. */
async function testConfirmationCapture(): Promise<void> {
  const tokens = new OpaqueTokenService(
    new ConfigService({ AUTH_TOKEN_HMAC_SECRET: 'capture-test-only-purpose-separated-key' }),
  );
  const first = `${ID}.${'A'.repeat(43)}`;
  const second = `00000000-0000-4000-8000-000000000002.${'A'.repeat(43)}`;
  const from = 'no-reply@example.test';
  const webBase = 'http://localhost:5173';
  const messages = [
    { ...OWNED_MESSAGE, ID: 'confirmation-one', Subject: EMAIL_CONFIRMATION.SUBJECT },
    { ...OWNED_MESSAGE, ID: 'confirmation-two', Subject: EMAIL_CONFIRMATION.SUBJECT },
  ];
  request.mockResolvedValueOnce(response({ messages, messages_count: 2 }));

  for (const [index, token] of [first, second].entries()) {
    request.mockResolvedValueOnce(
      response({
        ...messages[index],
        From: { Address: from },
        Text: createConfirmationMessage(webBase, { rawToken: token, to: RECIPIENT }).text,
      }),
    );
  }

  const capture = new OwnedMailCapture(RECIPIENT, EMAIL_CONFIRMATION.SUBJECT);
  await expect(capture.readConfirmationTokens(2, from, webBase, tokens)).resolves.toEqual([
    first,
    second,
  ]);

  for (const [url, options] of request.mock.calls) {
    expect(String(url).startsWith('http://mailpit:8025/api/v1/')).toBe(true);
    expect(options?.redirect).toBe('error');
  }
}

/** Rejects foreign origins, routes, query tokens and fragment additions without following a captured URL. */
async function testConfirmationLinkBoundary(): Promise<void> {
  const tokens = new OpaqueTokenService(
    new ConfigService({ AUTH_TOKEN_HMAC_SECRET: 'capture-test-only-purpose-separated-key' }),
  );
  const token = `${ID}.${'A'.repeat(43)}`;
  const message = { ...OWNED_MESSAGE, Subject: EMAIL_CONFIRMATION.SUBJECT };

  for (const link of [
    `http://foreign.test/confirm-email#token=${token}`,
    `http://localhost:5173/other#token=${token}`,
    `http://localhost:5173/confirm-email?token=${token}`,
    `http://localhost:5173/confirm-email#token=${token}&extra=true`,
  ]) {
    request.mockReset();
    request.mockResolvedValueOnce(response({ messages: [message], messages_count: 1 }));
    request.mockResolvedValueOnce(
      response({
        ...message,
        From: { Address: 'no-reply@example.test' },
        Text: `Use this link to confirm your email:\n\n${link}\n\nIf you did not request this email, you can ignore it.`,
      }),
    );
    const capture = new OwnedMailCapture(RECIPIENT, EMAIL_CONFIRMATION.SUBJECT);
    await expect(
      capture.readConfirmationTokens(1, 'no-reply@example.test', 'http://localhost:5173', tokens),
    ).rejects.toThrow('MAIL-CAPTURE confirmation');
    expect(request).toHaveBeenCalledTimes(2);
  }
}

/** Proves an empty owned result never becomes Mailpit's delete-all request. */
async function testEmptyCleanup(): Promise<void> {
  request.mockResolvedValueOnce(response({ messages: [], messages_count: 0 }));

  await new OwnedMailCapture(RECIPIENT, SUBJECT).cleanup();

  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0]?.[1]?.method).not.toBe('DELETE');
}

/** Ignores unrelated subjects and refuses foreign recipients even when a subject collides. */
async function testForeignMessages(): Promise<void> {
  request.mockResolvedValueOnce(
    response({
      messages: [{ ...OWNED_MESSAGE, To: [{ Address: 'foreign@example.test' }] }],
      messages_count: 1,
    }),
  );

  await expect(new OwnedMailCapture(RECIPIENT, SUBJECT).cleanup()).rejects.toThrow('ownership');

  expect(request).toHaveBeenCalledOnce();
}

/** Fails verification if a provider acknowledges deletion but owned messages remain. */
async function testIncompleteCleanup(): Promise<void> {
  request.mockResolvedValueOnce(response({ messages: [OWNED_MESSAGE], messages_count: 1 }));
  await expect(new OwnedMailCapture(RECIPIENT, SUBJECT).assertEmpty()).rejects.toThrow(
    'cleanup incomplete',
  );
}

/** Records a late-visible owned delivery for cleanup without deleting unrelated messages. */
async function testLateOwnedMessage(): Promise<void> {
  request
    .mockResolvedValueOnce(response({ messages: [], messages_count: 0 }))
    .mockResolvedValueOnce(
      response({
        messages: [
          OWNED_MESSAGE,
          { ...OWNED_MESSAGE, ID: 'foreign-message', Subject: 'Other subject' },
        ],
        messages_count: 2,
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const capture = new OwnedMailCapture(RECIPIENT, SUBJECT);

  await capture.assertAvailable();
  await capture.cleanup();

  expect(request.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ IDs: [CAPTURE_ID] }));
}

/** Proves exact capture and recorded-ID cleanup, including the fixed private destination. */
async function testOwnedCleanup(): Promise<void> {
  request
    .mockResolvedValueOnce(response({ messages: [], messages_count: 0 }))
    .mockResolvedValueOnce(response({ messages: [OWNED_MESSAGE], messages_count: 1 }))
    .mockResolvedValueOnce(
      response({
        ...OWNED_MESSAGE,
        From: { Address: 'no-reply@example.test' },
        Text: 'Private text\r\n',
      }),
    )
    .mockResolvedValueOnce(response({ messages: [OWNED_MESSAGE], messages_count: 1 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const capture = new OwnedMailCapture(RECIPIENT, SUBJECT);

  await capture.assertAvailable();
  await capture.verifyText('Private text', 'no-reply@example.test');
  await capture.cleanup();

  expect(request).toHaveBeenLastCalledWith(
    'http://mailpit:8025/api/v1/messages',
    expect.objectContaining({
      body: JSON.stringify({ IDs: [CAPTURE_ID] }),
      method: 'DELETE',
      redirect: 'error',
    }),
  );

  for (const [url, options] of request.mock.calls) {
    expect(String(url).startsWith('http://mailpit:8025/api/v1/')).toBe(true);
    expect(options?.redirect).toBe('error');
  }
}

/** Rejects arbitrary mailbox/subject input before any private API request can open. */
function testOwnershipBoundary(): void {
  expect(() => new OwnedMailCapture('foreign@example.test', SUBJECT)).toThrow('ownership');
  expect(() => new OwnedMailCapture(RECIPIENT, 'Arbitrary subject')).toThrow('ownership');
  expect(request).not.toHaveBeenCalled();
}

/** Refuses dangerous latest/path-like IDs and malformed pagination before deletion. */
async function testUnsafeCaptureId(): Promise<void> {
  request.mockResolvedValueOnce(
    response({ messages: [{ ...OWNED_MESSAGE, ID: 'latest' }], messages_count: 1 }),
  );

  await expect(new OwnedMailCapture(RECIPIENT, SUBJECT).cleanup()).rejects.toThrow('ownership');

  expect(request).toHaveBeenCalledOnce();
}

beforeEach(prepare);
afterEach(cleanup);
test('captures private content and deletes only recorded owned IDs', testOwnedCleanup);
test('never issues delete-all when owned results are empty', testEmptyCleanup);
test('refuses foreign recipient messages', testForeignMessages);
test('cleans late-visible owned delivery without touching other subjects', testLateOwnedMessage);
test('fails instead of skipping unavailable capture', testCaptureUnavailable);
test('rejects latest capture identifiers', testUnsafeCaptureId);
test('refuses arbitrary capture ownership', testOwnershipBoundary);
test('captures bounded confirmation replacement links without navigation', testConfirmationCapture);
test('rejects malformed or foreign confirmation links', testConfirmationLinkBoundary);
test('refuses to report cleanup complete while owned messages remain', testIncompleteCleanup);
