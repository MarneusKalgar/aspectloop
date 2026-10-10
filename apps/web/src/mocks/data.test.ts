import { describe, expect, it } from 'vitest';

import { createMockUser, findMockUserByEmail, toMockPublicUser } from './data';
import { defaultMockReviewerCredentials } from './fixtures/default-reviewer';

/** Groups the minimal D3 account-state changes without implementing E2's confirmation mock. */
describe('registration mock compatibility', () => {
  /** Keeps the real mock signup path unverified and duplicate profiles/credentials unchanged. */
  it('creates unverified normalized accounts and never overwrites duplicates', () => {
    const first = createMockUser({
      displayName: 'Original',
      email: ' D3-Mock@Example.Test ',
      password: ' exact password ',
    });
    const duplicate = createMockUser({
      displayName: 'Forbidden',
      email: 'd3-mock@example.test',
      password: 'different-password',
    });
    expect(first.emailVerified).toBe(false);
    expect(duplicate).toBe(first);
    expect(duplicate.displayName).toBe('Original');
    expect(duplicate.password).toBe(' exact password ');
    expect(toMockPublicUser(first)).not.toHaveProperty('password');
    expect(toMockPublicUser(first)).not.toHaveProperty('emailVerified');
  });

  /** Preserves the explicitly verified reviewer fixture for existing signin/product tests. */
  it('retains the verified default reviewer', () => {
    expect(findMockUserByEmail(defaultMockReviewerCredentials.email)?.emailVerified).toBe(true);
  });
});
