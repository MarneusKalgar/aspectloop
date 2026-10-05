import type { IncomingMessage } from 'node:http';

import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

import type { LiveOperation } from './gate-operations.ts';

export interface SafeObservation {
  bearer: boolean;
  cookieWrites: number;
  identity: null | string;
  noStore: boolean;
  operation: LiveOperation;
  received: boolean;
  success: boolean;
}

/** Reads safe response metadata even with compression; original wire bytes stay unchanged. */
export function observeResponse(
  observation: SafeObservation,
  response: IncomingMessage,
  bytes: Buffer,
): void {
  observation.received = true;
  observation.cookieWrites = response.headers['set-cookie']?.length ?? 0;
  observation.noStore = response.headers['cache-control']?.includes('no-store') === true;

  try {
    const encoding = response.headers['content-encoding'];
    const limits = { maxOutputLength: 1_048_576 };
    let decoded = bytes;

    if (encoding === 'gzip') {
      decoded = gunzipSync(bytes, limits);
    } else if (encoding === 'br') {
      decoded = brotliDecompressSync(bytes, limits);
    } else if (encoding === 'deflate') {
      decoded = inflateSync(bytes, limits);
    }

    const result = JSON.parse(decoded.toString('utf8')) as {
      data?: { me?: { id?: unknown } };
      errors?: unknown[];
    };
    const id = result.data?.me?.id;
    observation.identity = typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id) ? id : null;
    observation.success = response.statusCode === 200 && !!result.data && !result.errors?.length;
  } catch {
    observation.identity = null;
    observation.success = false;
  }
}
