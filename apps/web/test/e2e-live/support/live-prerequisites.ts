import { LIVE_TOPOLOGY } from './live-topology.ts';

/** Checks the fixed credentialed CORS path before supplying any private browser fixture. */
export async function verifyGatePreflight(): Promise<void> {
  const response = await fetch(LIVE_TOPOLOGY.gate.graphqlUrl, {
    headers: {
      'access-control-request-headers': 'content-type',
      'access-control-request-method': 'POST',
      origin: LIVE_TOPOLOGY.web.origin,
    },
    method: 'OPTIONS',
    signal: AbortSignal.timeout(5_000),
  });

  if (
    response.status !== 204 ||
    response.headers.get('access-control-allow-origin') !== LIVE_TOPOLOGY.web.origin ||
    response.headers.get('access-control-allow-credentials') !== 'true'
  ) {
    throw new Error('E1 approved-origin CORS prerequisite failed');
  }
}

/** Bounds readiness while distinguishing a Platform-only outage from a missing Gateway. */
export async function waitForGateway(ready: boolean): Promise<void> {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(LIVE_TOPOLOGY.gateway.readinessUrl, {
        signal: AbortSignal.timeout(3_000),
      });
      const body = (await response.json()) as {
        code?: unknown;
        service?: unknown;
        status?: unknown;
      };

      if (
        ready &&
        response.status === 200 &&
        body.service === 'gateway-api' &&
        body.status === 'ready'
      ) {
        return;
      }

      if (!ready && response.status === 503 && body.code === 'PLATFORM_UNAVAILABLE') {
        const liveness = await fetch(LIVE_TOPOLOGY.gateway.livenessUrl, {
          signal: AbortSignal.timeout(3_000),
        });
        const alive = (await liveness.json()) as { service?: unknown; status?: unknown };

        if (liveness.status === 200 && alive.service === 'gateway-api' && alive.status === 'ok') {
          return;
        }
      }
    } catch {
      // A missing Gateway is never proof of a Platform-only outage.
    }

    await new Promise<void>(
      /** A bounded readiness poll, not synchronization for a browser race. */
      (resolve) => setTimeout(resolve, 250),
    );
  }

  throw new Error('E1 Gateway readiness prerequisite failed');
}
