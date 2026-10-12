import { describe, expect, it } from 'vitest';

import { createSignInSchema, createSignUpSchema } from './auth';

/** Uses fixed translation keys rather than requiring mounted UI for cheap schema behavior. */
function translate(key: string): string {
  return key;
}

/** Groups registration-only admission assertions while keeping existing sign-in compatibility. */
describe('D3 registration validation', () => {
  /** Preserves exact credential bytes while activating the registration mailbox bound. */
  it('keeps password bytes and rejects oversized registration mailboxes', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
    const input = { displayName: ' Reviewer ', email, password: ' password ' };
    expect(createSignUpSchema(translate).parse(input)).toEqual({
      ...input,
      displayName: 'Reviewer',
    });
    expect(createSignUpSchema(translate).safeParse({ ...input, email: `${email}d` }).success).toBe(
      false,
    );
    expect(
      createSignInSchema(translate).safeParse({ email: `${email}d`, password: input.password })
        .success,
    ).toBe(true);
  });
});
