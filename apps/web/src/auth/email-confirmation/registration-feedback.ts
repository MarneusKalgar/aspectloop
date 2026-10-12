import { AUTH_ERROR_CODE, AUTH_ERROR_POLICY } from '@aspectloop/contracts/platform';

/** Extracts only the server's bounded retry delay, never an upstream message or private detail. */
export function registrationRetryDelay(error: unknown): null | number {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('extensions' in error) {
    const delay = readRetryDelay(error.extensions);

    if (delay !== null) {
      return delay;
    }
  }

  if ('errors' in error && Array.isArray(error.errors)) {
    const errors: unknown[] = error.errors;

    for (const nested of errors) {
      const delay = registrationRetryDelay(nested);

      if (delay !== null) {
        return delay;
      }
    }
  }

  return 'cause' in error ? registrationRetryDelay(error.cause) : null;
}

/** Narrows only integer retry delays admitted by the public auth contract. */
function isBoundedRetryDelay(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= AUTH_ERROR_POLICY.RETRY_AFTER_MS_MIN &&
    value <= AUTH_ERROR_POLICY.RETRY_AFTER_MS_MAX
  );
}

/** Reads rate-limit metadata without admitting upstream messages or unrelated error codes. */
function readRetryDelay(extensions: unknown): null | number {
  if (!extensions || typeof extensions !== 'object') {
    return null;
  }

  if (!('code' in extensions) || extensions.code !== AUTH_ERROR_CODE.RATE_LIMITED) {
    return null;
  }

  if (!('retryAfterMs' in extensions) || !isBoundedRetryDelay(extensions.retryAfterMs)) {
    return null;
  }

  return extensions.retryAfterMs;
}
