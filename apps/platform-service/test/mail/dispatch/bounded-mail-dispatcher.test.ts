import { BoundedMailDispatcher } from '@platform/mail/dispatch/bounded-mail-dispatcher';
import {
  MAIL_ADMISSION,
  MAIL_LIMITS,
  MAIL_OUTCOME,
  type MailAttempt,
  type MailAttemptOutcome,
  type MailMessage,
  type MailTransport,
} from '@platform/mail/mail.port';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const MESSAGE: MailMessage = {
  subject: 'Transport fixture',
  text: 'Private bounded content',
  to: 'fixture@example.test',
};

interface ControlledAttempt extends MailAttempt {
  reject: (error: Error) => void;
  succeed: (outcome: MailAttemptOutcome) => void;
}

/** Retains controllable attempts without any network dependency or hidden dispatch queue. */
class ControlledTransport implements MailTransport {
  readonly attempts: ControlledAttempt[] = [];
  readonly messages: MailMessage[] = [];

  /** Starts one manually settled send for deterministic concurrency/deadline coverage. */
  start(message: MailMessage): ControlledAttempt {
    let succeed!: ControlledAttempt['succeed'];
    let reject!: ControlledAttempt['reject'];

    /** Makes transport completion independent of wall-clock timing. */
    const result = new Promise<MailAttemptOutcome>((resolve, rejectResult) => {
      succeed = resolve;
      reject = rejectResult;
    });
    const attempt = { cancel: vi.fn(), reject, result, succeed };

    this.attempts.push(attempt);
    this.messages.push(message);

    return attempt;
  }
}

const dispatchers: BoundedMailDispatcher[] = [];

/** Disposes active/queued sends and restores global timer ownership. */
function cleanup(): void {
  for (const dispatcher of dispatchers.splice(0)) {
    dispatcher.onApplicationShutdown();
  }

  vi.useRealTimers();
}

/** Constructs a dispatcher that the test cleanup will always shut down. */
function createDispatcher(transport: MailTransport, report = vi.fn()): BoundedMailDispatcher {
  const dispatcher = new BoundedMailDispatcher(transport, report);

  dispatchers.push(dispatcher);

  return dispatcher;
}

/** Selects a deterministic clock before any send is admitted. */
function prepareClock(): void {
  vi.useFakeTimers();
}

/** Clears all deadlines and settles receipts while refusing new sends after uncertain teardown. */
async function testCancellationFailure(): Promise<void> {
  const transport = new ControlledTransport();
  const dispatcher = createDispatcher(transport);
  const first = dispatcher.enqueue(MESSAGE);
  const second = dispatcher.enqueue(MESSAGE);
  const waiting = dispatcher.enqueue(MESSAGE);
  const cancellation = vi.mocked(transport.attempts[0]!.cancel);

  /** Models a broken provider contract without permitting its private diagnostic to escape. */
  cancellation.mockImplementationOnce(() => {
    throw new Error('PRIVATE-CANCELLATION-FAILURE');
  });

  await vi.advanceTimersByTimeAsync(MAIL_LIMITS.DEADLINE_MS);

  expect(await first.completion).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(await second.completion).toBe(MAIL_OUTCOME.STOPPED);
  expect(await waiting.completion).toBe(MAIL_OUTCOME.STOPPED);
  expect(transport.attempts).toHaveLength(2);
  expect(transport.attempts[1]?.cancel).toHaveBeenCalledOnce();
  expect(dispatcher.enqueue(MESSAGE)).toEqual({ admission: MAIL_ADMISSION.STOPPED });
  expect(vi.getTimerCount()).toBe(0);

  transport.attempts[0]?.succeed(MAIL_OUTCOME.SENT);

  expect(await first.completion).toBe(MAIL_OUTCOME.SMTP_FAILED);
}

/** Proves only two sends start and the 101st waiting message is refused immediately. */
function testCapacity(): void {
  const transport = new ControlledTransport();
  const report = vi.fn();
  const dispatcher = createDispatcher(transport, report);

  for (let index = 0; index < MAIL_LIMITS.ACTIVE + MAIL_LIMITS.WAITING; index += 1) {
    expect(dispatcher.enqueue(MESSAGE).admission).toBe(MAIL_ADMISSION.QUEUED);
  }

  expect(transport.attempts).toHaveLength(2);
  expect(dispatcher.enqueue(MESSAGE)).toEqual({ admission: MAIL_ADMISSION.QUEUE_FULL });
  expect(report).toHaveBeenCalledExactlyOnceWith(MAIL_ADMISSION.QUEUE_FULL);
}

/** Pins the public wire values independently of their consumers and proves runtime immutability. */
function testConstants(): void {
  expect(MAIL_ADMISSION).toEqual({
    INVALID_MESSAGE: 'invalid-message',
    QUEUE_FULL: 'queue-full',
    QUEUED: 'queued',
    STOPPED: 'stopped',
  });
  expect(MAIL_OUTCOME).toEqual({
    SENT: 'sent',
    SMTP_FAILED: 'smtp-failed',
    STOPPED: 'stopped',
    TIMEOUT: 'timeout',
  });
  expect(Object.isFrozen(MAIL_ADMISSION)).toBe(true);
  expect(Object.isFrozen(MAIL_OUTCOME)).toBe(true);
}

/** Proves a deadline cancels active attempts and starts queued work with a fresh deadline. */
async function testDeadline(): Promise<void> {
  const transport = new ControlledTransport();
  const report = vi.fn();
  const dispatcher = createDispatcher(transport, report);
  const first = dispatcher.enqueue(MESSAGE);
  const second = dispatcher.enqueue(MESSAGE);
  const waiting = dispatcher.enqueue(MESSAGE);

  await vi.advanceTimersByTimeAsync(4999);

  expect(transport.attempts).toHaveLength(2);
  expect(transport.attempts[0]?.cancel).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(1);

  expect(await first.completion).toBe(MAIL_OUTCOME.TIMEOUT);
  expect(await second.completion).toBe(MAIL_OUTCOME.TIMEOUT);
  expect(transport.attempts[0]?.cancel).toHaveBeenCalledOnce();
  expect(transport.attempts[1]?.cancel).toHaveBeenCalledOnce();
  expect(transport.attempts).toHaveLength(3);

  transport.attempts[0]?.succeed(MAIL_OUTCOME.SENT);
  transport.attempts[2]?.succeed(MAIL_OUTCOME.SENT);

  expect(await waiting.completion).toBe(MAIL_OUTCOME.SENT);
  expect(report.mock.calls).toEqual([[MAIL_OUTCOME.TIMEOUT], [MAIL_OUTCOME.TIMEOUT]]);
  expect(vi.getTimerCount()).toBe(0);
}

/** Proves raw provider rejection becomes one fixed category with no automatic retry. */
async function testFailure(): Promise<void> {
  const transport = new ControlledTransport();
  const report = vi.fn();
  const dispatcher = createDispatcher(transport, report);
  const receipt = dispatcher.enqueue(MESSAGE);

  transport.attempts[0]?.reject(new Error('Private SMTP recipient/token/body details'));

  expect(await receipt.completion).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(report.mock.calls).toEqual([[MAIL_OUTCOME.SMTP_FAILED]]);
  expect(transport.attempts).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
}

/** Rejects injected headers and oversized retained content before starting SMTP. */
function testMessageBounds(): void {
  const transport = new ControlledTransport();
  const dispatcher = createDispatcher(transport);
  const invalidMessages = [
    { ...MESSAGE, to: 'fixture@example.test\r\nBcc: other@example.test' },
    { ...MESSAGE, subject: 'Subject\r\nBcc: other@example.test' },
    { ...MESSAGE, text: 'a'.repeat(MAIL_LIMITS.TEXT_BYTES + 1) },
    { ...MESSAGE, text: '\0' },
    { ...MESSAGE, subject: 'a'.repeat(MAIL_LIMITS.SUBJECT_BYTES + 1) },
  ];

  for (const message of invalidMessages) {
    expect(dispatcher.enqueue(message)).toEqual({ admission: MAIL_ADMISSION.INVALID_MESSAGE });
  }

  expect(transport.attempts).toHaveLength(0);
}

/** Keeps failure settlement and queue pumping independent of a throwing diagnostic observer. */
async function testObserverFailure(): Promise<void> {
  const transport = new ControlledTransport();
  /** Models a logger failure that must not become an unhandled delivery rejection. */
  const report = vi.fn(() => {
    throw new Error('PRIVATE-OBSERVER-FAILURE');
  });
  const dispatcher = createDispatcher(transport, report);
  const first = dispatcher.enqueue(MESSAGE);
  const second = dispatcher.enqueue(MESSAGE);
  const waiting = dispatcher.enqueue(MESSAGE);

  expect(dispatcher.hasReportingFailure()).toBe(false);

  transport.attempts[0]?.succeed(MAIL_OUTCOME.SMTP_FAILED);

  expect(await first.completion).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(dispatcher.hasReportingFailure()).toBe(true);
  expect(transport.attempts).toHaveLength(3);

  transport.attempts[1]?.succeed(MAIL_OUTCOME.SENT);
  transport.attempts[2]?.succeed(MAIL_OUTCOME.SENT);

  expect(await second.completion).toBe(MAIL_OUTCOME.SENT);
  expect(await waiting.completion).toBe(MAIL_OUTCOME.SENT);
  expect(vi.getTimerCount()).toBe(0);
}

/** Preserves queue-full refusal even when its diagnostic observer throws. */
function testQueueFullObserverFailure(): void {
  const transport = new ControlledTransport();
  /** Models an unavailable logger without changing bounded admission semantics. */
  const report = vi.fn(() => {
    throw new Error('PRIVATE-OBSERVER-FAILURE');
  });
  const dispatcher = createDispatcher(transport, report);

  for (let index = 0; index < MAIL_LIMITS.ACTIVE + MAIL_LIMITS.WAITING; index += 1) {
    dispatcher.enqueue(MESSAGE);
  }

  expect(dispatcher.enqueue(MESSAGE)).toEqual({ admission: MAIL_ADMISSION.QUEUE_FULL });
  expect(dispatcher.hasReportingFailure()).toBe(true);
  expect(transport.attempts).toHaveLength(MAIL_LIMITS.ACTIVE);
}

/** Proves shutdown cancels active work, discards waiting payloads, and stops admission. */
async function testShutdown(): Promise<void> {
  const transport = new ControlledTransport();
  const dispatcher = createDispatcher(transport);
  const receipts = [
    dispatcher.enqueue(MESSAGE),
    dispatcher.enqueue(MESSAGE),
    dispatcher.enqueue(MESSAGE),
  ];

  dispatcher.onApplicationShutdown();
  dispatcher.onApplicationShutdown();

  for (const receipt of receipts) {
    expect(await receipt.completion).toBe(MAIL_OUTCOME.STOPPED);
  }

  expect(transport.attempts).toHaveLength(2);
  expect(transport.attempts[0]?.cancel).toHaveBeenCalledOnce();
  expect(transport.attempts[1]?.cancel).toHaveBeenCalledOnce();
  expect(dispatcher.enqueue(MESSAGE)).toEqual({ admission: MAIL_ADMISSION.STOPPED });
  expect(vi.getTimerCount()).toBe(0);
}

/** Proves queued payloads are snapshots and success neither retries nor leaks a timer. */
async function testSuccess(): Promise<void> {
  const transport = new ControlledTransport();
  const dispatcher = createDispatcher(transport);
  const message = { ...MESSAGE };
  const receipt = dispatcher.enqueue(message);
  message.text = 'Changed after admission';

  expect(transport.messages[0]?.text).toBe(MESSAGE.text);

  transport.attempts[0]?.succeed(MAIL_OUTCOME.SENT);

  expect(await receipt.completion).toBe(MAIL_OUTCOME.SENT);
  expect(transport.attempts[0]?.cancel).toHaveBeenCalledOnce();
  expect(transport.attempts).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
}

/** Converts synchronous provider construction failures to safe completed receipts. */
async function testSynchronousFailure(): Promise<void> {
  const transport = {
    /** Models provider construction failing before an attempt is returned. */
    start(): MailAttempt {
      throw new Error('Private construction failure');
    },
  };
  const receipt = createDispatcher(transport).enqueue(MESSAGE);

  expect(await receipt.completion).toBe(MAIL_OUTCOME.SMTP_FAILED);
  expect(vi.getTimerCount()).toBe(0);
}

beforeEach(prepareClock);
afterEach(cleanup);
test('freezes admission/outcome constants without changing their wire values', testConstants);
test('bounds active sends and waiting capacity', testCapacity);
test('cancels at the overall dispatch deadline and releases the worker', testDeadline);
test('snapshots messages and disposes successful attempts without retry', testSuccess);
test('strips provider failures and does not retry', testFailure);
test('shutdown discards queued mail and cancels active attempts', testShutdown);
test('rejects unsafe or oversized plain-text messages', testMessageBounds);
test('settles synchronous provider failure safely', testSynchronousFailure);
test(
  'fails closed and clears deadlines when provider cancellation throws',
  testCancellationFailure,
);
test('continues queue progression when the observer throws', testObserverFailure);
test('returns queue-full even when the observer throws', testQueueFullObserverFailure);
