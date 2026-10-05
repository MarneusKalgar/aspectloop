import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createServer } from 'node:http';

import type { LiveOperation } from './gate-operations.ts';
import type { SafeObservation } from './response-observation.ts';

import { forwardResponse } from './forward-response.ts';
import { readRequestBody, selectedOperation } from './gate-operations.ts';
import { HeldResponse } from './held-response.ts';
import { LIVE_TOPOLOGY } from './live-topology.ts';

/** Cookie-neutral fixed-local forwarding; raw buffers stay private and are never reported. */
export class ResponseGate {
  maxCookieActions = 0;
  readonly observations: SafeObservation[] = [];
  unexpectedRequests = 0;
  private readonly active = new Set<HeldResponse>();
  private activeActions = 0;
  private readonly holds: HeldResponse[] = [];
  private readonly server = createServer(
    /** Separates safe observations from transient request/response bytes. */
    (incoming, outgoing) => {
      void this.forward(incoming, outgoing);
    },
  );
  private readonly upstreams = new Set<ClientRequest>();

  /** Returns a safe count without exposing request bodies or auth headers. */
  count(operation: LiveOperation): number {
    return this.observations.filter(
      /** Selects only the fixed operation name. */
      (observation) => observation.operation === operation,
    ).length;
  }

  /** Arms one selected operation; each response consumes at most one hold. */
  holdNext(operation: LiveOperation): HeldResponse {
    const hold = new HeldResponse(operation);
    this.holds.push(hold);
    this.active.add(hold);

    return hold;
  }

  /** Releases every owned barrier on test failure as well as normal completion. */
  releaseAll(): void {
    for (const hold of this.active) {
      hold.release();
    }

    this.holds.length = 0;
    this.active.clear();
  }

  /** Binds only loopback; port zero is available solely to focused tool tests. */
  async start(port: number = LIVE_TOPOLOGY.gate.port): Promise<number> {
    await new Promise<void>(
      /** Fails on an occupied port rather than taking over an existing listener. */
      (resolve, reject) => {
        this.server.once('error', reject);
        this.server.listen(
          port,
          LIVE_TOPOLOGY.gate.host,
          /** Releases the startup barrier only after the owned listener is bound. */
          () => {
            this.server.off('error', reject);
            resolve();
          },
        );
      },
    );

    return (this.server.address() as AddressInfo).port;
  }

  /** Disposes held bytes, pending upstreams and owned sockets deterministically. */
  async stop(): Promise<void> {
    this.releaseAll();

    for (const upstream of this.upstreams) {
      upstream.destroy();
    }

    this.server.closeAllConnections();

    await new Promise<void>(
      /** Joins listener closure without persisting transport diagnostics. */
      (resolve) =>
        this.server.close(
          /** Completes closure without retaining raw listener diagnostics. */
          () => resolve(),
        ),
    );
  }

  /** Forwards only approved GraphQL roots; transport owns transient buffers and settlement. */
  private async forward(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    try {
      if (
        incoming.url !== '/graphql' ||
        incoming.headers.origin !== LIVE_TOPOLOGY.web.origin ||
        !['OPTIONS', 'POST'].includes(incoming.method ?? '')
      ) {
        outgoing.writeHead(403).end();
        return;
      }

      const body = await readRequestBody(incoming);
      let operation: LiveOperation | null = null;

      if (incoming.method === 'POST') {
        try {
          operation = selectedOperation(body);
        } catch {
          this.unexpectedRequests += 1;
          outgoing.writeHead(403).end();
          return;
        }
      }

      const observation: null | SafeObservation = operation
        ? {
            bearer: !!incoming.headers.authorization,
            cookieWrites: 0,
            identity: null,
            noStore: false,
            operation,
            received: false,
            success: false,
          }
        : null;

      if (observation) {
        this.observations.push(observation);
      }

      const holdIndex = this.holds.findIndex(
        /** Consumes the next explicitly armed response of this operation. */
        (candidate) => candidate.operation === operation,
      );
      const hold = holdIndex < 0 ? undefined : this.holds.splice(holdIndex, 1)[0];

      forwardResponse({
        body,
        hold,
        incoming,
        observation,
        onSettled: this.trackCookieAction(operation),
        outgoing,
        upstreams: this.upstreams,
      });
    } catch {
      outgoing.destroy();
    }
  }

  /** Starts safe overlap accounting and returns an idempotent browser-settlement callback. */
  private trackCookieAction(operation: LiveOperation | null): () => void {
    const cookieAction = operation === 'SignIn' || operation === 'SignOut';
    let finished = false;

    if (cookieAction) {
      this.activeActions += 1;
      this.maxCookieActions = Math.max(this.maxCookieActions, this.activeActions);
    }

    /** Counts delivery or cancellation once, without inferring server rollback. */
    return () => {
      if (cookieAction && !finished) {
        finished = true;
        this.activeActions -= 1;
      }
    };
  }
}
