import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { expect, test, vi } from 'vitest';

import { PasswordService } from '../../src/auth/credentials/password.service';

const { DUMMY_HASH } = vi.hoisted(() => ({
  DUMMY_HASH: '$2b$04$verification-only-dummy-hash',
}));

vi.mock('bcryptjs', () => ({
  compare: vi.fn().mockResolvedValue(false),
  hash: vi.fn().mockResolvedValue(DUMMY_HASH),
}));

/** Verifies missing identities still execute one bcrypt comparison and cannot match. */
async function testDummyComparison(): Promise<void> {
  const service = new PasswordService(new ConfigService({ BCRYPT_SALT_ROUNDS: 4 }));

  await expect(service.verifyOrDummy('password', null)).resolves.toBe(false);
  expect(bcrypt.hash).toHaveBeenCalledWith('aspectloop-dummy-credential', 4);
  expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  expect(bcrypt.compare).toHaveBeenCalledWith('password', DUMMY_HASH);
}

test('uses a configured-cost dummy comparison for unknown identities', testDummyComparison);
