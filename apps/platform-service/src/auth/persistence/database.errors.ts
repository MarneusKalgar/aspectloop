import { QueryFailedError } from 'typeorm';

const POSTGRES_UNAVAILABLE_CODES = new Set([
  '55P03',
  '57P01',
  '57P02',
  '57P03',
  '53300',
  '57014',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
]);
const TYPEORM_UNAVAILABLE_ERROR_NAMES = new Set([
  'CannotExecuteNotConnectedError',
  'CannotGetEntityManagerNotConnectedError',
  'ConnectionIsNotSetError',
]);
const PG_POOL_TIMEOUT_MESSAGES = new Set([
  'Connection terminated due to connection timeout',
  'timeout exceeded when trying to connect',
]);

/** Marks an invalid database-clock result as an unavailable auth dependency. */
export class AuthDatabaseUnavailableError extends Error {}

/** Returns whether an error represents a supported transient database failure. */
export function isAuthDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof AuthDatabaseUnavailableError) {
    return true;
  }

  if (error instanceof Error && TYPEORM_UNAVAILABLE_ERROR_NAMES.has(error.name)) {
    return true;
  }

  const candidate: unknown =
    error instanceof QueryFailedError ? (error.driverError as unknown) : error;
  const code = readErrorCode(candidate);

  if (code !== null) {
    return code.startsWith('08') || POSTGRES_UNAVAILABLE_CODES.has(code);
  }

  return (
    candidate instanceof Error &&
    candidate.constructor === Error &&
    PG_POOL_TIMEOUT_MESSAGES.has(candidate.message)
  );
}

/** Reads a bounded driver error code without trusting arbitrary error objects. */
function readErrorCode(error: unknown): null | string {
  if (error === null || typeof error !== 'object' || !('code' in error)) {
    return null;
  }

  const code = error.code;

  return typeof code === 'string' && code.length <= 32 ? code : null;
}
