import type { DataSource } from 'typeorm';

import { AUTH_ERROR_CODE } from '@aspectloop/contracts/platform';
import { ConfigService } from '@nestjs/config';
import { OpaqueTokenService } from '@platform/auth/credentials/opaque-token.service';
import { RegistrationStore } from '@platform/auth/registration/registration.store';
import { expect, test, vi } from 'vitest';

/** Converts only supported connection failures into the fixed auth dependency envelope. */
async function databaseClassification(): Promise<void> {
  const context = fixture();
  context.transaction.mockRejectedValueOnce(
    Object.assign(new Error('private driver details'), { code: 'ECONNREFUSED' }),
  );
  await expect(context.store.resend('reviewer@example.test')).rejects.toMatchObject({
    response: { code: AUTH_ERROR_CODE.DEPENDENCY_UNAVAILABLE },
  });
  const unexpected = Object.assign(new Error('private integrity defect'), { code: '23505' });
  context.transaction.mockRejectedValueOnce(unexpected);
  await expect(context.store.resend('reviewer@example.test')).rejects.toBe(unexpected);
}

/** Creates store boundaries without opening a database or exposing real HMAC material. */
function fixture() {
  const config = new ConfigService({
    AUTH_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS: 60_000,
    AUTH_EMAIL_CONFIRMATION_TTL_MS: 86_400_000,
    AUTH_TOKEN_HMAC_SECRET: 'registration-store-test-only-hmac-material',
  });
  const tokens = new OpaqueTokenService(config);
  const transaction = vi.fn();
  const store = new RegistrationStore({ transaction } as unknown as DataSource, config, tokens);

  return { store, tokens, transaction };
}

/** Rejects malformed candidates before the HMAC matcher or transaction can receive them. */
async function invalidBeforeDatabase(): Promise<void> {
  const context = fixture();
  const matches = vi.spyOn(context.tokens, 'matches');

  for (const raw of ['', 'malformed', 'x'.repeat(129)]) {
    await expect(context.store.confirm(raw)).rejects.toMatchObject({
      response: { code: AUTH_ERROR_CODE.CONFIRMATION_INVALID },
    });
  }

  expect(matches).not.toHaveBeenCalled();
  expect(context.transaction).not.toHaveBeenCalled();
}

test('invalid confirmation candidates never reach the database', invalidBeforeDatabase);
test(
  'registration classifies supported outages without hiding integrity defects',
  databaseClassification,
);
