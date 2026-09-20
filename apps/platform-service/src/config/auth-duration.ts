import ms, { type StringValue } from 'ms';

/**
 * Parses the configured access-token duration into milliseconds.
 *
 * @param value Human-readable duration accepted by the `ms` package.
 * @returns Positive duration in milliseconds, or null for malformed input.
 */
export function parseAccessTokenTtlMs(value: string): null | number {
  try {
    const duration = ms(value as StringValue);

    return typeof duration === 'number' && Number.isSafeInteger(duration) && duration > 0
      ? duration
      : null;
  } catch {
    return null;
  }
}
