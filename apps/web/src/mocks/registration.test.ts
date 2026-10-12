import { describe, expect, it } from 'vitest';

import { createMockUser, findMockUserByEmail, getMockSessionUser } from './data';
import { defaultMockReviewerCredentials } from './fixtures/default-reviewer';
import {
  consumeMockConfirmation,
  getMockConfirmationToken,
  requestMockConfirmation,
} from './registration';

describe('registration mock contract', /** Groups mock state transitions without public token disclosure. */ () => {
  /** Duplicate requests preserve credentials/profile and do not replace a cooling-down token. */
  it('models cooldown, replacement, single consume and no automatic session', () => {
    const email = 'mock-confirmation-transitions@example.test';
    const original = createMockUser({
      displayName: 'Original',
      email,
      password: 'original-password',
    });
    requestMockConfirmation(email, 1000);
    const first = getMockConfirmationToken(email)!;
    createMockUser({ displayName: 'Replacement', email, password: 'replacement-password' });
    requestMockConfirmation(email, 2000);
    expect(getMockConfirmationToken(email)).toBe(first);
    requestMockConfirmation(email, 61_000);
    const second = getMockConfirmationToken(email)!;
    expect(second).not.toBe(first);
    expect(consumeMockConfirmation(first, 62_000)).toBe(false);
    expect(consumeMockConfirmation(second, 62_000)).toBe(true);
    expect(consumeMockConfirmation(second, 62_000)).toBe(false);
    expect(findMockUserByEmail(email)).toBe(original);
    expect(original.password).toBe('original-password');
    expect(original.displayName).toBe('Original');
    expect(getMockSessionUser()).toBeNull();
  });

  /** Unknown/verified suppression and expiry share the same public acknowledgement/invalidity. */
  it('issues no token for unknown or verified accounts and rejects expiry', () => {
    requestMockConfirmation('unknown-mock@example.test');
    requestMockConfirmation(defaultMockReviewerCredentials.email);
    expect(getMockConfirmationToken('unknown-mock@example.test')).toBeNull();
    expect(getMockConfirmationToken(defaultMockReviewerCredentials.email)).toBeNull();
    const email = 'mock-confirmation-expiry@example.test';
    createMockUser({ displayName: 'Expired', email, password: 'fixture-password' });
    requestMockConfirmation(email, 1000);
    expect(consumeMockConfirmation(getMockConfirmationToken(email)!, 3_601_000)).toBe(false);
  });
});
