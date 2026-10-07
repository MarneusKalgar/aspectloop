import type { LiveOperation } from './gate-operations.ts';

/** An explicit bounded barrier; it carries no payload or browser-managed cookie jar. */
class Signal {
  readonly promise: Promise<void>;
  private resolve!: () => void;
  private settled = false;

  /** Initializes the resolver after fields under both native and transpiled class semantics. */
  constructor() {
    this.promise = new Promise<void>(
      /** Retains only a completion callback, never request data. */
      (resolve) => {
        this.resolve = resolve;
      },
    );
  }

  /** Completes the barrier idempotently on delivery, cancellation or teardown. */
  finish(): void {
    if (!this.settled) {
      this.settled = true;
      this.resolve();
    }
  }

  /** Rejects a missing causal event instead of silently succeeding after a delay. */
  async wait(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.promise,
        new Promise<never>(
          /** Bounds a live transport barrier without exposing its payload. */
          (_resolve, reject) => {
            timer = setTimeout(
              /** Fails with a fixed category only. */
              () => reject(new Error('E1 response barrier timed out')),
              15_000,
            );
          },
        ),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Holds the entire genuine response, including all Set-Cookie headers. */
export class HeldResponse {
  /** Identifies one selected operation only; no arbitrary forwarding controls exist. */
  readonly operation: LiveOperation;
  private readonly arrival = new Signal();
  private clientClosed = false;
  private delivery: (() => void) | null = null;
  private released = false;

  private readonly settlement = new Signal();

  /** Stores only a fixed operation name so Node's native type stripping can load tool tests. */
  constructor(operation: LiveOperation) {
    this.operation = operation;
  }

  /** Makes client cancellation observable without pretending remote rollback. */
  close(): void {
    this.clientClosed = true;
    this.settlement.finish();
    this.release();
  }

  /** Waits for browser transport closure or completed delivery. */
  async closed(): Promise<void> {
    await this.settlement.wait();
  }

  /** Records completed downstream delivery, not just upstream completion. */
  delivered(): void {
    this.settlement.finish();
  }

  /** Signals upstream receipt separately from downstream cookie delivery. */
  hold(delivery: () => void): void {
    this.delivery = delivery;
    this.arrival.finish();

    if (this.released || this.clientClosed) {
      this.release();
    }
  }

  /** Waits for a complete buffered backend response. */
  async received(): Promise<void> {
    await this.arrival.wait();
  }

  /** Delivers real headers/body only once; a closed receiver cannot gain permission. */
  release(): void {
    this.released = true;
    const delivery = this.delivery;
    this.delivery = null;
    delivery?.();
  }
}
