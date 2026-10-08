import type { Socket } from 'node:net';
import type { Readable } from 'node:stream';
import type SMTPConnection from 'nodemailer/lib/smtp-connection';

import { SmtpOwnedResources } from '@platform/mail/smtp/smtp-owned-resources';
import { EventEmitter } from 'node:events';
import { expect, test, vi } from 'vitest';

class ControlledConnection extends EventEmitter {
  readonly close = vi.fn();
}

/** Models destroy followed by a separately delivered close, without actual I/O or timers. */
class ControlledResource extends EventEmitter {
  closed = false;
  readonly destroy = vi.fn();

  /** Delivers close after any intentionally late teardown errors. */
  close(): void {
    this.closed = true;

    this.emit('close');
  }
}

/** Gives one owner isolated handles and stable callbacks without contacting a provider. */
function createOwnedResources() {
  const connected = vi.fn();
  const failed = vi.fn();
  const socket = new ControlledResource();
  const stream = new ControlledResource();
  const connection = new ControlledConnection();
  const resources = new SmtpOwnedResources(connected, failed);

  resources.attachSocket(socket as unknown as Socket, false);
  resources.attachConnection(connection as unknown as SMTPConnection);
  resources.attachStream(stream as unknown as Readable);

  return { connected, connection, failed, resources, socket, stream };
}

/** Does not leave guards waiting for close when a resource has already closed. */
function testAlreadyClosed(): void {
  const { resources, socket, stream } = createOwnedResources();
  socket.closed = true;
  stream.closed = true;

  resources.dispose();

  expect(socket.listenerCount('error')).toBe(0);
  expect(stream.listenerCount('error')).toBe(0);
  expect(socket.listenerCount('close')).toBe(0);
  expect(stream.listenerCount('close')).toBe(0);
}

/** Removes only owner-installed guards, not a third party's error listener. */
function testForeignListenerPreserved(): void {
  const { resources, socket } = createOwnedResources();
  const foreignListener = vi.fn();

  socket.on('error', foreignListener);

  resources.dispose();

  socket.emit('error', new Error('PRIVATE-LATE-ERROR'));
  socket.close();

  expect(resources.teardownFailed).toBe(true);
  expect(foreignListener).toHaveBeenCalledOnce();
  expect(socket.listeners('error')).toEqual([foreignListener]);
}

/** Releases all owned handles and never registers a second guard or destroys twice. */
function testIdempotentDisposal(): void {
  const { connection, resources, socket, stream } = createOwnedResources();

  expect(resources.teardownFailed).toBe(false);

  resources.dispose();
  resources.dispose();

  expect(resources.socket).toBeNull();
  expect(resources.connection).toBeNull();
  expect(connection.close).toHaveBeenCalledOnce();
  expect(connection.eventNames()).toEqual([]);
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(stream.destroy).toHaveBeenCalledOnce();
  expect(socket.listenerCount('error')).toBe(1);
  expect(stream.listenerCount('error')).toBe(1);
  expect(socket.listenerCount('close')).toBe(1);
  expect(stream.listenerCount('close')).toBe(1);
}

/** Consumes late errors without retaining them or invoking the disposed attempt again. */
function testLateErrorsAndClose(): void {
  const { connected, failed, resources, socket, stream } = createOwnedResources();

  resources.dispose();

  expect(resources.teardownFailed).toBe(false);

  socket.emit('error', new Error('PRIVATE-SOCKET-ERROR'));
  stream.emit('error', new Error('PRIVATE-STREAM-ERROR'));
  socket.emit('connect');

  expect(resources.teardownFailed).toBe(true);
  expect(JSON.stringify(resources)).not.toContain('PRIVATE');
  expect(connected).not.toHaveBeenCalled();
  expect(failed).not.toHaveBeenCalled();

  socket.close();
  stream.close();

  expect(socket.listenerCount('error')).toBe(0);
  expect(stream.listenerCount('error')).toBe(0);
  expect(socket.listenerCount('close')).toBe(0);
  expect(stream.listenerCount('close')).toBe(0);
}

/** Records provider-close failure while still physically destroying socket and MIME stream. */
function testProviderCloseFailure(): void {
  const { connection, resources, socket, stream } = createOwnedResources();
  /** Models a private provider error that the owner must reduce to a boolean. */
  connection.close.mockImplementationOnce(() => {
    throw new Error('PRIVATE-PROVIDER-CLOSE');
  });

  resources.dispose();

  expect(resources.teardownFailed).toBe(true);
  expect(JSON.stringify(resources)).not.toContain('PRIVATE');
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(stream.destroy).toHaveBeenCalledOnce();
}

test('owns handles and disposes exactly once', testIdempotentDisposal);
test('records late teardown errors and removes guards at close', testLateErrorsAndClose);
test(
  'records provider-close failure without retaining private diagnostics',
  testProviderCloseFailure,
);
test('preserves unrelated resource error listeners', testForeignListenerPreserved);
test('does not register teardown guards on already closed resources', testAlreadyClosed);
