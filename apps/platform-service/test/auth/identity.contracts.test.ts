import {
  platformSignInRequestSchema,
  platformSignUpRequestSchema,
} from '@aspectloop/contracts/platform';
import { expect, test } from 'vitest';

/** Verifies identity schemas normalize email but preserve exact password bytes. */
function testIdentityNormalizationBoundary(): void {
  const parsed = platformSignInRequestSchema.parse({
    email: ' Reviewer@Example.Test ',
    password: ' password ',
  });

  expect(parsed).toEqual({ email: 'reviewer@example.test', password: ' password ' });
}

/** Verifies both sign-in and signup reject passwords bcrypt would truncate. */
function testPasswordByteBoundary(): void {
  const oversizedPassword = '🙂'.repeat(19);

  expect(
    platformSignInRequestSchema.safeParse({
      email: 'reviewer@example.test',
      password: oversizedPassword,
    }).success,
  ).toBe(false);
  expect(
    platformSignUpRequestSchema.safeParse({
      displayName: 'Reviewer',
      email: 'reviewer@example.test',
      password: oversizedPassword,
    }).success,
  ).toBe(false);
}

/** Verifies signup trims presentation fields while preserving credential bytes. */
function testSignUpNormalizationBoundary(): void {
  const parsed = platformSignUpRequestSchema.parse({
    displayName: ' Reviewer ',
    email: ' Reviewer@Example.Test ',
    password: ' password ',
  });

  expect(parsed).toEqual({
    displayName: 'Reviewer',
    email: 'reviewer@example.test',
    password: ' password ',
  });
  expect(
    platformSignUpRequestSchema.safeParse({
      displayName: '   ',
      email: 'reviewer@example.test',
      password: 'password',
    }).success,
  ).toBe(false);
}

test(
  'normalizes identity email while preserving password bytes',
  testIdentityNormalizationBoundary,
);
test(
  'normalizes signup presentation fields without changing password bytes',
  testSignUpNormalizationBoundary,
);
test('rejects passwords beyond the bcrypt UTF-8 byte boundary', testPasswordByteBoundary);
