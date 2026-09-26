import type { Plugin } from 'graphql-yoga';

import { GraphQLError } from 'graphql';

import { boundRetry, GatewayAuthIpLimiter, MAX_AUTH_RETRY_MS } from './auth-ip-limiter';
import { inspectMutationRoots } from './mutation-root-inspection';
import { getOperationProtectionPolicy } from './operation-policy';

/** Applies universal request rules and declared operation policies before execution. */
export function createGatewayRequestProtectionPlugin(
  allowedOrigins: readonly string[],
  limiter = new GatewayAuthIpLimiter(),
): Plugin {
  const origins = new Set(allowedOrigins);

  return {
    /** Examines selected mutation roots before any resolver or domain call runs. */
    onParams({ context, params, request, setResult }) {
      if (request.method !== 'POST' || typeof params.query !== 'string') {
        return;
      }

      let roots: null | string[];

      try {
        roots = inspectMutationRoots(params.query, params.operationName);
      } catch {
        setResult(rejectedOperation('Invalid GraphQL document.'));
        return;
      }

      if (!roots) {
        return;
      }

      const policies = roots.map(getOperationProtectionPolicy);

      if (roots.length !== 1 && policies.some((policy) => policy?.requiresSoleRoot)) {
        setResult(rejectedOperation('This mutation must be the sole root field.'));
        return;
      }

      const ip = getSocketIp(context);

      for (const policy of policies) {
        const limitPolicy = policy?.rateLimit;

        if (!limitPolicy) {
          continue;
        }

        if (!ip) {
          setResult(rateLimited(MAX_AUTH_RETRY_MS));
          return;
        }

        const retryAfterMs = limiter.consume(limitPolicy, ip);

        if (retryAfterMs !== null) {
          setResult(rateLimited(retryAfterMs));
          return;
        }
      }
    },

    /** Rejects unsafe browser requests before Yoga parses their body. */
    onRequestParse({ endResponse, fetchAPI, request, requestParser, setRequestParser }) {
      if (request.method !== 'POST') {
        return;
      }

      const origin = request.headers.get('origin');

      if (!origin || !origins.has(origin)) {
        endResponse(new fetchAPI.Response('Forbidden', { status: 403 }));
        return;
      }

      const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();

      if (mediaType !== 'application/json') {
        endResponse(new fetchAPI.Response('JSON POST required', { status: 415 }));
        return;
      }

      if (requestParser) {
        setRequestParser(async (incomingRequest) => {
          try {
            return await requestParser(incomingRequest);
          } catch {
            return new fetchAPI.Response('Invalid GraphQL request.', { status: 400 });
          }
        });
      }
    },
  };
}

/** Reads Express's socket-derived IP, never an untrusted forwarded header. */
function getSocketIp(context: unknown): null | string {
  if (typeof context !== 'object' || context === null || !('req' in context)) {
    return null;
  }

  const request = context.req;

  if (typeof request !== 'object' || request === null || !('socket' in request)) {
    return null;
  }

  const socket = request.socket;

  if (typeof socket !== 'object' || socket === null || !('remoteAddress' in socket)) {
    return null;
  }

  return typeof socket.remoteAddress === 'string' && socket.remoteAddress.length > 0
    ? socket.remoteAddress
    : null;
}

/** Builds an auth limit response without revealing keys or raw request data. */
function rateLimited(retryAfterMs: number): { errors: GraphQLError[] } {
  return {
    errors: [
      new GraphQLError('Too many authentication requests.', {
        extensions: {
          code: 'AUTH_RATE_LIMITED',
          http: { status: 429 },
          retryAfterMs: boundRetry(retryAfterMs),
        },
      }),
    ],
  };
}

/** Builds a safe pre-execution GraphQL rejection. */
function rejectedOperation(message: string): { errors: GraphQLError[] } {
  return {
    errors: [
      new GraphQLError(message, {
        extensions: { code: 'BAD_REQUEST', http: { status: 400 } },
      }),
    ],
  };
}
