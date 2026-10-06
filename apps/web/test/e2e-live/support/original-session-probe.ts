import { LIVE_TOPOLOGY } from './live-topology.ts';

const MAX_RESPONSE_BYTES = 4096;

/** Probes only original-session Me through the fixed gate; secrets and raw errors never escape. */
export async function originalSessionState(
  credential: null | string,
  expectedId: string,
): Promise<'active' | 'invalid'> {
  if (!credential) {
    throw new Error('E1 original-session credential missing; details omitted.');
  }

  try {
    const response = await fetch(LIVE_TOPOLOGY.gate.graphqlUrl, {
      body: JSON.stringify({ operationName: 'Me', query: 'query Me { me { id } }' }),
      headers: {
        'content-type': 'application/json',
        cookie: `aspectloop_session=${credential}`,
        origin: LIVE_TOPOLOGY.web.origin,
      },
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status !== 200 || !response.body || response.headers.has('set-cookie')) {
      await response.body?.cancel();
      throw new Error('E1 original-session response rejected');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
      while (true) {
        const part = await reader.read();

        if (part.done) {
          break;
        }

        size += part.value.byteLength;

        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error('E1 original-session response ceiling');
        }

        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }

    const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      data?: { me?: { id?: unknown } };
      errors?: { extensions?: { code?: unknown } }[];
    };

    if (result.data?.me?.id === expectedId && !result.errors?.length) {
      return 'active';
    }

    if (
      !result.data?.me &&
      result.errors?.length === 1 &&
      result.errors[0].extensions?.code === 'AUTH_SESSION_INVALID'
    ) {
      return 'invalid';
    }

    throw new Error('E1 original-session outcome rejected');
  } catch {
    // Deliberately discard fetch/parser causes, which can contain credentials or response bytes.
    throw new Error('E1 original-session probe failed; details omitted.');
  }
}
