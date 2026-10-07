import { parsePrivateFixtureInput } from '@platform/db/verify/auth-http/private-fixture-input';
import { describe, expect, it } from 'vitest';

const id = 'd41be59c-d8eb-4e8c-a5e1-99aab7197f04';
const password = 'synthetic-private-input';

describe('private browser fixture input' /** Covers strict private-tool input without a database, terminal or production fixture. */, () => {
  it('accepts one exact owned ID and a bounded ASCII password' /** Preserves password bytes without converting them to environment configuration. */, () => {
    expect(parsePrivateFixtureInput(JSON.stringify({ id, password }))).toEqual({ id, password });
  });

  it('rejects malformed, oversized, secret-bearing-extra and invalid-password input safely' /** Proves parser errors do not retain a cause/input from Zod or JSON. */, () => {
    const inputs = [
      '{invalid',
      JSON.stringify({ id: '../all', password }),
      JSON.stringify({ id, password: 'short' }),
      JSON.stringify({ id, password: 'x'.repeat(73) }),
      JSON.stringify({ id, password: 'non-ascii-\u00e9-password' }),
      JSON.stringify({ credential: 'extra', id, password }),
      'x'.repeat(257),
    ];

    for (const raw of inputs) {
      let caught: unknown;

      try {
        parsePrivateFixtureInput(raw);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe('Invalid private fixture input');
      expect((caught as Error).cause).toBeUndefined();
    }
  });
});
