import { QueryFailedError } from 'typeorm';
import { expect, test } from 'vitest';

import {
  AuthDatabaseUnavailableError,
  isAuthDatabaseUnavailableError,
} from '../../src/auth/persistence/database.errors';

/** Verifies only explicit connectivity, timeout, and lock failures map to unavailable. */
function testDatabaseFailureClassification(): void {
  expect(
    isAuthDatabaseUnavailableError(
      new QueryFailedError('SELECT 1', [], Object.assign(new Error('lock'), { code: '55P03' })),
    ),
  ).toBe(true);
  expect(
    isAuthDatabaseUnavailableError(Object.assign(new Error('network'), { code: 'ECONNRESET' })),
  ).toBe(true);
  expect(isAuthDatabaseUnavailableError(new AuthDatabaseUnavailableError())).toBe(true);
  expect(
    isAuthDatabaseUnavailableError(
      Object.assign(new Error('not connected'), { name: 'CannotExecuteNotConnectedError' }),
    ),
  ).toBe(true);
  expect(
    isAuthDatabaseUnavailableError(
      new QueryFailedError('INSERT', [], Object.assign(new Error('unique'), { code: '23505' })),
    ),
  ).toBe(false);
  expect(isAuthDatabaseUnavailableError(new TypeError('programming error'))).toBe(false);
}

test('classifies only supported transient database failures', testDatabaseFailureClassification);
