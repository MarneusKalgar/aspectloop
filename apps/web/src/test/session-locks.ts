/** Models queued exclusive locks in tests only; production never installs this fallback. */
export function createQueuedTestLocks() {
  const tails = new Map<string, Promise<void>>();
  return {
    /** Orders synchronous/asynchronous work even when a waiting acquisition is aborted. */
    async request<T>(
      name: string,
      options: LockOptions,
      callback: () => Promise<T> | T,
    ): Promise<T> {
      const previous = tails.get(name) ?? Promise.resolve();
      const task = previous.then(
        /** Starts protected work only after earlier owners release and acquisition remains live. */
        async (): Promise<T> => {
          if (options.signal?.aborted) {
            throw new DOMException('Lock acquisition aborted', 'AbortError');
          }
          return await callback();
        },
      );
      tails.set(
        name,
        task.then(
          /** Successful work releases the next queued owner. */
          () => undefined,
          /** Failed work also releases the exclusive queue. */
          () => undefined,
        ),
      );
      if (!options.signal) {
        return task;
      }
      return waitForAcquisition(task, options.signal);
    },
  };
}

/** Rejects only the waiting caller while preserving the underlying exclusive queue. */
async function waitForAcquisition<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  let rejectAbort: () => void =
    /** Initializes the removable handler before constructing the cancellation promise. */
    () => undefined;
  const aborted = new Promise<never>(
    /** Models prompt native acquisition cancellation, not remote action rollback. */
    (_resolve, reject) => {
      /** Supplies the safe native acquisition abort outcome. */
      rejectAbort = () => reject(new DOMException('Lock acquisition aborted', 'AbortError'));
      signal.addEventListener('abort', rejectAbort, { once: true });
      if (signal.aborted) {
        rejectAbort();
      }
    },
  );

  try {
    return await Promise.race([task, aborted]);
  } finally {
    signal.removeEventListener('abort', rejectAbort);
  }
}
