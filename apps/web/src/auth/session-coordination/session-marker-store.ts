import type { MarkerTransition } from './session-marker-transitions';

import { requireSessionLock, type SessionEnvironment } from './browser-environment';
import { parseSessionMarker, SESSION_MARKER_LOCK, type SessionMarker } from './session-marker';

/** Owns validated storage and atomic marker writes; the coordinator still owns revisions. */
export class SessionMarkerStore {
  private marker: null | SessionMarker = null;
  private raw: null | string | undefined;

  /** Reports storage changes synchronously before notifying peer tabs. */
  constructor(
    private readonly environment: SessionEnvironment,
    private readonly changed: (marker: null | SessionMarker) => void,
  ) {}

  /** Treats corruption, denied access, and deletion after initialization as blocking state. */
  refresh(): void {
    try {
      const raw = this.environment.read();
      if (raw === null && this.raw !== undefined && this.raw !== null) {
        throw new Error('Coordination storage was removed during an active browser session.');
      }

      if (raw === this.raw && this.marker) {
        return;
      }

      const marker = parseSessionMarker(raw);
      this.raw = raw;
      this.marker = marker;
      this.changed(marker);
    } catch {
      if (this.marker !== null) {
        this.invalidate();
      }
    }
  }

  /** Holds only the marker lock; never awaits cache/network work or acquires the cookie lock. */
  async update<T>(
    transition: (marker: SessionMarker) => MarkerTransition<T>,
    localLogout = false,
  ): Promise<T> {
    /** Revalidates the durable record and publishes an atomic transition before peer hints. */
    const write = (): T => {
      let marker: SessionMarker;

      try {
        this.refresh();
        if (!this.marker) {
          throw new Error('Session coordination storage is unavailable.');
        }
        marker = parseSessionMarker(this.environment.read());
      } catch {
        this.invalidate();
        throw new Error('Session coordination storage is unavailable.');
      }

      const next = transition(marker);
      if (next.marker === marker) {
        this.refresh();
        return next.result;
      }

      const raw = JSON.stringify(next.marker);
      parseSessionMarker(raw);

      try {
        this.environment.write(raw);
      } catch {
        this.invalidate();
        throw new Error('Session coordination storage is unavailable.');
      }

      this.refresh();

      this.environment.notify();

      return next.result;
    };

    if (this.environment.withLock) {
      return this.environment.withLock(SESSION_MARKER_LOCK, write);
    }

    if (localLogout) {
      // Suppression only: no browser tab without Locks may dispatch account mutations.
      return write();
    }

    return requireSessionLock(this.environment)(SESSION_MARKER_LOCK, write);
  }

  /** Forces invalidation for failed writes even when storage was already inaccessible. */
  private invalidate(): void {
    this.marker = null;
    this.changed(null);
  }
}
