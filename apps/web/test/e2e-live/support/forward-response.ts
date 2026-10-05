import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';

import { request } from 'node:http';

import type { HeldResponse } from './held-response.ts';
import type { SafeObservation } from './response-observation.ts';

import { LIVE_TOPOLOGY } from './live-topology.ts';
import { observeResponse } from './response-observation.ts';

interface ForwardedResponse {
  body: Buffer;
  hold?: HeldResponse;
  incoming: IncomingMessage;
  observation: null | SafeObservation;
  onSettled: () => void;
  outgoing: ServerResponse;
  upstreams: Set<ClientRequest>;
}

/** Owns one fixed-local upstream and buffers its genuine response before cookie delivery. */
export function forwardResponse({
  body,
  hold,
  incoming,
  observation,
  onSettled,
  outgoing,
  upstreams,
}: ForwardedResponse): void {
  let upstream: ClientRequest | undefined;

  try {
    outgoing.once(
      'close',
      /** Signals cancelled receivers while leaving remote effects classified as uncertain. */
      () => {
        onSettled();
        hold?.close();
      },
    );

    upstream = request(LIVE_TOPOLOGY.gateway.graphqlUrl, {
      headers: { ...incoming.headers, host: LIVE_TOPOLOGY.gateway.hostHeader },
      method: incoming.method,
    });
    upstreams.add(upstream);
    const ownedUpstream = upstream;

    upstream.setTimeout(
      8_000,
      /** Terminates an unreachable fixed upstream; never fabricates an auth payload. */
      () => ownedUpstream.destroy(new Error('E1 upstream timeout')),
    );

    upstream.once(
      'error',
      /** Closes browser transport without logging a potentially private error. */
      () => {
        outgoing.destroy();
        onSettled();
        hold?.close();
        upstreams.delete(ownedUpstream);
      },
    );

    upstream.once(
      'response',
      /** Buffers complete genuine headers/body before any browser cookie processing. */
      (response) => {
        const parts: Buffer[] = [];
        let responseSize = 0;

        response.on(
          'data',
          /** Bounds held memory without exposing contents. */
          (chunk: Buffer) => {
            responseSize += chunk.length;

            if (responseSize > 1_048_576) {
              ownedUpstream.destroy();
              outgoing.destroy();
              return;
            }

            parts.push(chunk);
          },
        );

        response.once(
          'error',
          /** Closes incomplete responses; partial bytes can never satisfy a receipt barrier. */
          () => {
            outgoing.destroy();
            hold?.close();
          },
        );

        response.once(
          'end',
          /** Captures safe metadata and provides a one-shot delivery closure. */
          () => {
            upstreams.delete(ownedUpstream);
            let payload: Buffer | null = Buffer.concat(parts);
            parts.length = 0;

            if (observation) {
              observeResponse(observation, response, payload);
            }

            /** Releases original status/raw headers (including separate Set-Cookie) and body unchanged. */
            const deliver = (): void => {
              if (!outgoing.destroyed && payload) {
                outgoing.writeHead(response.statusCode ?? 502, response.rawHeaders);

                outgoing.end(
                  payload,
                  /** Completes the downstream delivery barrier and action counter. */
                  () => {
                    onSettled();
                    hold?.delivered();
                  },
                );
              }

              payload = null;
            };

            if (hold) {
              hold.hold(deliver);
            } else {
              deliver();
            }
          },
        );
      },
    );

    upstream.end(body);
  } catch {
    upstream?.destroy();
    outgoing.destroy();
    onSettled();
    hold?.close();
  }
}
