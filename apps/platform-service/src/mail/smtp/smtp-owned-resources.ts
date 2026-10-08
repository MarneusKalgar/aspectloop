import type { Socket } from 'node:net';
import type { Readable } from 'node:stream';
import type SMTPConnection from 'nodemailer/lib/smtp-connection';

/** Owns physical SMTP handles, listener registration, and idempotent teardown. */
export class SmtpOwnedResources {
  /** Supplies a borrowed SMTP connection without transferring lifecycle ownership. */
  get connection(): null | SMTPConnection {
    return this.smtpConnection;
  }
  /** Supplies a borrowed socket while this owner is active; disposal erases the handle. */
  get socket(): null | Socket {
    return this.physicalSocket;
  }
  /** Records only whether teardown failed, never provider errors, messages, or addresses. */
  get teardownFailed(): boolean {
    return this.teardownFailure;
  }
  private disposed = false;
  private mimeStream: null | Readable = null;
  private readonly onTeardownError: () => void;

  private physicalSocket: null | Socket = null;

  private smtpConnection: null | SMTPConnection = null;

  private teardownFailure = false;

  /** Retains stable attempt callbacks and binds payload-free teardown accounting once. */
  constructor(
    private readonly onConnected: () => void,
    private readonly onFailure: (error?: unknown) => void,
  ) {
    this.onTeardownError = this.markTeardownFailure.bind(this);
  }

  /** Takes ownership of provider state and its failure/end callbacks exactly once. */
  attachConnection(connection: SMTPConnection): void {
    if (this.disposed || this.smtpConnection) {
      throw new Error('SMTP connection ownership unavailable');
    }

    this.smtpConnection = connection;

    connection.once('error', this.onFailure);
    connection.once('end', this.onFailure);
  }

  /** Takes ownership of the socket and its connection-phase callbacks exactly once. */
  attachSocket(socket: Socket, secure: boolean): void {
    if (this.disposed || this.physicalSocket) {
      throw new Error('SMTP socket ownership unavailable');
    }

    this.physicalSocket = socket;

    socket.once(secure ? 'secureConnect' : 'connect', this.onConnected);
    socket.once('error', this.onFailure);
    socket.once('close', this.onFailure);
  }

  /** Takes ownership of the MIME stream and its submission error callback exactly once. */
  attachStream(stream: Readable): void {
    if (this.disposed || this.mimeStream) {
      throw new Error('SMTP stream ownership unavailable');
    }

    this.mimeStream = stream;

    stream.once('error', this.onFailure);
  }

  /** Erases handles and destroys owned resources, even when provider close fails. */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const socket = this.physicalSocket;
    const connection = this.smtpConnection;
    const stream = this.mimeStream;
    this.physicalSocket = null;
    this.smtpConnection = null;
    this.mimeStream = null;

    socket?.off('connect', this.onConnected);
    socket?.off('secureConnect', this.onConnected);
    socket?.off('error', this.onFailure);
    socket?.off('close', this.onFailure);

    if (socket) {
      this.guardTeardownErrors(socket);
    }

    try {
      connection?.close();
    } catch {
      this.markTeardownFailure();
    }

    connection?.removeAllListeners();

    stream?.off('error', this.onFailure);

    if (stream) {
      this.guardTeardownErrors(stream);
    }

    try {
      stream?.destroy();
    } finally {
      socket?.destroy();
    }
  }

  /** Consumes errors only until close; the close callback releases its borrowed resource reference. */
  private guardTeardownErrors(resource: Readable | Socket): void {
    if (resource.closed) {
      return;
    }

    resource.on('error', this.onTeardownError);
    // Bind once for this resource's sole teardown; dispose() cannot register it again.
    resource.once('close', this.releaseTeardownGuard.bind(this, resource));
  }

  /** Retains a bounded failure flag without keeping or emitting the raw late error. */
  private markTeardownFailure(): void {
    this.teardownFailure = true;
  }

  /** Removes the owner's temporary guard without removing unrelated resource listeners. */
  private releaseTeardownGuard(resource: Readable | Socket): void {
    resource.off('error', this.onTeardownError);
  }
}
