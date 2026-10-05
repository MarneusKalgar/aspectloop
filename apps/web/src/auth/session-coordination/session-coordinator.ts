import { requireSessionLock, type SessionEnvironment } from './browser-environment';
import {
  classifyCookieActionFailure,
  type CookieActionFailure,
  requestCookieAction,
} from './cookie-action-request';
import { SESSION_COOKIE_LOCK, type SessionMarker } from './session-marker';
import { SessionMarkerStore } from './session-marker-store';
import {
  acknowledgeSignIn,
  acknowledgeSignOut,
  beginSignIn,
  beginSignOut,
  failCookieAction,
  orphanPendingAction,
  publishLogoutIntent,
} from './session-marker-transitions';

export interface CoordinationSnapshot {
  failure: null | SessionFailure;
  localLogout: boolean;
  marker: null | SessionMarker;
  revision: number;
}

export type SessionFailure = 'invalid' | 'unavailable';

/** Owns tab ordering and revision invalidation; Platform remains the session authority. */
export class SessionCoordinator {
  private readonly listeners = new Set<() => void>();
  private readonly markers: SessionMarkerStore;
  private snapshot: CoordinationSnapshot = {
    failure: null,
    localLogout: false,
    marker: null,
    revision: 0,
  };

  /** Keeps browser primitives injectable and creates no process-global state. */
  constructor(private readonly environment: SessionEnvironment) {
    this.markers = new SessionMarkerStore(
      environment,
      /** Valid storage changes retire transient failures; storage loss preserves them. */
      (marker) => {
        const failure = marker ? null : this.snapshot.failure;
        this.publish({ ...this.snapshot, failure, marker });
      },
    );
    this.refresh();
  }

  /** Recognizes only a still-current generation after rereading durable intent. */
  accepts(revision: number): boolean {
    return this.isCurrent(revision) && this.canRead();
  }

  /** Blocks new reads while cookies are changing or logout suppression is durable. */
  canRead(): boolean {
    const { localLogout, marker } = this.snapshot;
    return !!marker && !localLogout && !marker.logoutIntent && !marker.action;
  }

  /** Allows registration after confirmed logout without reopening session bootstrap. */
  canRegister(): boolean {
    const { localLogout, marker } = this.snapshot;
    return (
      !!marker &&
      !localLogout &&
      !marker.action &&
      (!marker.logoutIntent || marker.revocation === 'confirmed')
    );
  }

  /** Reports current product-session failures without rewriting cookies or shared intent. */
  fail(failure: SessionFailure, revision: number): void {
    if (this.accepts(revision)) {
      this.publish({ ...this.snapshot, failure });
    }
  }

  /** Supplies React and transport with a stable snapshot until a real change occurs. */
  getSnapshot = (): CoordinationSnapshot => this.snapshot;

  /** Detects abandoned pending actions only after acquiring their actual cookie lock. */
  async inspectPending(): Promise<void> {
    this.refresh();

    if (this.snapshot.marker?.action?.status !== 'pending' || !this.environment.withLock) {
      return;
    }

    await this.environment.withLock(
      SESSION_COOKIE_LOCK,
      /** Lock release identifies an orphan, never proof of remote rollback. */
      async () => {
        await this.markers.update(
          /** Keeps unknown actions blocked; timestamps cannot make them safe again. */
          (marker) => orphanPendingAction(marker, this.environment.uuid()),
        );
      },
    );
  }

  /** Recognizes current work only after rereading durable state. */
  isCurrent(revision: number): boolean {
    this.refresh();

    return revision === this.snapshot.revision;
  }

  /** Delegates the storage trust boundary while retaining synchronous revision publication. */
  refresh = (): void => {
    this.markers.refresh();
  };

  /** Clears only transient read failures; durable logout and unknown actions are untouched. */
  retryRead(): void {
    this.refresh();

    if (this.canRead() || this.canRegister()) {
      this.publish({ ...this.snapshot, failure: null });
    }
  }

  /** Serializes one explicit login and accepts only its unchanged action epoch. */
  async signIn<T>(execute: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.refresh();

    const expectedRevision = this.snapshot.revision;
    const lock = requireSessionLock(this.environment);
    return lock(
      SESSION_COOKIE_LOCK,
      /** Rechecks queued login state before recording or dispatching the action. */
      async () => {
        this.refresh();
        if (expectedRevision !== this.snapshot.revision || this.snapshot.localLogout) {
          throw new SessionOperationCancelledError();
        }

        const id = this.environment.uuid();
        await this.markers.update(
          /** Existing intent can be cleared only after confirmed revocation. */
          (marker) => beginSignIn(marker, id),
        );
        let value: T;

        try {
          value = await requestCookieAction(execute);
        } catch (error) {
          const failure = classifyCookieActionFailure(error, 'sign-in');
          this.refresh();

          const superseded = this.snapshot.marker?.epoch !== id;
          await this.finishFailure(id, failure);
          if (superseded) {
            throw new SessionOperationCancelledError();
          }

          if (failure.expectedRejection && this.snapshot.marker) {
            throw new SessionSignInRejectedError(error, this.snapshot.marker.epoch);
          }
          throw error;
        }

        const accepted = await this.markers.update(
          /** A newer logout wins even when this successful response already set a cookie. */
          (marker) => acknowledgeSignIn(marker, id, this.environment.uuid()),
        );
        if (!accepted) {
          throw new SessionOperationCancelledError();
        }

        return value;
      },
    );
  }

  /** Orders explicit revocation after local retirement; deferred failures retain their causes. */
  async signOut(
    execute: (signal: AbortSignal) => Promise<void>,
    retireCache: () => Promise<void>,
  ): Promise<void> {
    this.publish({ ...this.snapshot, failure: null, localLogout: true });

    let durableIntent = false;

    try {
      let intentError: Error | undefined;

      try {
        await this.markers.update(
          /** Preserves pending requests so queued logout cannot hide uncertainty. */
          (marker) => publishLogoutIntent(marker, this.environment.uuid()),
          true,
        );
        durableIntent = true;
      } catch (error) {
        intentError =
          error instanceof Error
            ? error
            : new Error('Session coordination storage is unavailable.', { cause: error });
      }

      // Cleanup must still run when marker storage or Locks are unavailable.
      let cacheError: Error | undefined;

      try {
        await retireCache();
      } catch (error) {
        cacheError =
          error instanceof Error
            ? error
            : new Error('Session cache retirement failed.', { cause: error });
      }

      if (intentError) {
        throw intentError;
      }

      const lock = requireSessionLock(this.environment);
      await lock(
        SESSION_COOKIE_LOCK,
        /** Never issues recovery against an unknown or abandoned earlier cookie action. */
        async () => {
          const id = this.environment.uuid();
          const dispatch = await this.markers.update(
            /** Peer acknowledgement/new login supersedes this delayed old logout. */
            (marker) => beginSignOut(marker, id),
          );
          if (!dispatch) {
            return;
          }

          try {
            await requestCookieAction(execute);
          } catch (error) {
            await this.finishFailure(id, classifyCookieActionFailure(error, 'sign-out'));
            throw error;
          }

          await this.markers.update(
            /** Suppression survives confirmed revocation until explicit login. */
            (marker) => acknowledgeSignOut(marker, id, this.environment.uuid()),
          );
          this.publish({ ...this.snapshot, localLogout: false });
        },
      );

      if (cacheError) {
        throw cacheError;
      }
    } finally {
      if (durableIntent && this.snapshot.localLogout) {
        this.publish({ ...this.snapshot, localLogout: false });
      }
    }
  }

  /** Attaches peer hints for this mounted app without trusting their payloads. */
  start(): () => void {
    const dispose = this.environment.listen(this.refresh);
    this.refresh();

    return dispose;
  }

  /** Registers synchronous invalidation before React or Apollo can deliver old work. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    /** Removes this consumer's subscription on teardown. */
    return () => this.listeners.delete(listener);
  };

  /** Exposes capability separately from ordinary read-only bootstrap. */
  supportsAccountActions(): boolean {
    return !!this.environment.withLock;
  }

  /** Commits an outcome only for its owning action, then releases local suppression. */
  private async finishFailure(id: string, failure: CookieActionFailure): Promise<void> {
    await this.markers.update(
      /** Newer logout intent remains authoritative when settling a failed login. */
      (marker) => failCookieAction(marker, id, this.environment.uuid(), failure),
    );

    this.publish({ ...this.snapshot, localLogout: false });
  }

  /** Publishes revision changes to synchronously retire response consumers. */
  private publish(snapshot: CoordinationSnapshot): void {
    this.snapshot = { ...snapshot, revision: this.snapshot.revision + 1 };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/** Settles cancelled consumers without disclosing obsolete data or server errors. */
export class SessionOperationCancelledError extends Error {
  /** Uses a fixed safe message for retired operations. */
  constructor() {
    super('The authentication state changed. Please try again.');
    this.name = 'SessionOperationCancelledError';
  }
}

/** Binds expected login feedback to the epoch that actually rejected that login. */
export class SessionSignInRejectedError extends Error {
  /** Keeps a transient cause for classification, never persistence or broadcast. */
  constructor(
    error: unknown,
    readonly epoch: string,
  ) {
    super('Sign-in was rejected.', { cause: error });
    this.name = 'SessionSignInRejectedError';
  }
}
